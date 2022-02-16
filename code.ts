figma.showUI(__html__, { visible: false, width: 600, height: 400 });
figma.skipInvisibleInstanceChildren = true;

// declarations
let uniqueStyleIds = [];
const allTextNodes = figma.root.findAllWithCriteria({
  types: ["TEXT"],
});

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function getStyleIdsWithName() {
  const uniqueStyleIds = [];

  for (var i = 0; i < allTextNodes.length; i++) {
    // sleep every 500 items to avoid figma freezing
    if (i % 500 === 0) {
      await sleep(1);
    }
    // iterate over segments, if segment has a styleId, add it to the list of ids
    if (typeof allTextNodes[i].textStyleId === "symbol") {
      allTextNodes[i].getStyledTextSegments(["textStyleId"]).forEach((segment) => {
        if (!uniqueStyleIds.includes(segment.textStyleId)) {
          uniqueStyleIds.push(segment.textStyleId);
        }
      });
    }
    //  if string, add to list of ids
    if (typeof allTextNodes[i].textStyleId === "string" && !uniqueStyleIds.includes(allTextNodes[i].textStyleId)) {
      uniqueStyleIds.push(allTextNodes[i].textStyleId);
    }
  }

  return uniqueStyleIds
    .map((styleId) => {
      const style = figma.getStyleById(styleId);
      return style
        ? {
            name: style.name.toLowerCase(),
            data: styleId,
          }
        : null;
    })
    .filter((n) => n);
}

// check if node contains old style and transform to new style
async function convertOldToNewStyle(parameters: ParameterValues) {
  let numberOfNodesUpdated = 0;

  allTextNodes.forEach((node) => {
    if (typeof node.textStyleId === "symbol") {
      node.getStyledTextSegments(["textStyleId"]).forEach((segment) => {
        const isSegmentStyleExist = parameters.hasOwnProperty(segment.textStyleId);
        if (isSegmentStyleExist) {
          numberOfNodesUpdated += 1;
          node.setRangeTextStyleId(segment.start, segment.end, parameters[segment.textStyleId]);
        }
      });
    } else if (parameters.hasOwnProperty(node.textStyleId)) {
      numberOfNodesUpdated += 1;
      node.textStyleId = parameters[node.textStyleId];
    }
  });

  return numberOfNodesUpdated;
}

async function startPluginWithParameters(parameters: ParameterValues) {
  let newParameters: any = parameters;

  // conditional check to know which mode the plugin is running in. It can be one of the 2 modes
  // 1. parameter mode
  // 2. UI mode (here is where we get input from user)
  // If false, it means it is running in parameter mode.
  if (!Array.isArray(parameters)) {
    newParameters[parameters["old-style"]] = parameters["new-style"];
  }

  const numberOfNodesUpdated = await convertOldToNewStyle(newParameters);
  figma.notify(`Styles swap done successfully and No. of nodes changed are ${numberOfNodesUpdated}`);
  figma.closePlugin();
}

figma.on("run", async ({ command, parameters }: RunEvent) => {
  if (parameters) {
    await startPluginWithParameters(parameters);
  }
});

async function runPlugin() {
  const ids = (uniqueStyleIds = await getStyleIdsWithName());

  figma.parameters.on("input", async ({ parameters, key, query, result }: ParameterInputEvent) => {
    switch (key) {
      case "old-style":
        result.setSuggestions(ids.filter((s) => s.name.includes(query.toLowerCase())));
        break;
      case "new-style":
        result.setSuggestions(ids.filter((s) => s.name.includes(query.toLowerCase())));
        break;
      default:
        return;
    }
  });
}

figma.ui.onmessage = (msg) => {
  if (msg.type === "check-and-update") {
    if (IsJsonString(msg.json)) {
      const inputObject: ParameterValues = JSON.parse(msg.json);

      const mappedUniqueStyleIds: ParameterValues = {};
      uniqueStyleIds.forEach((id: any) => {
        mappedUniqueStyleIds[id.name] = id.data;
      });

      const mappedObject = {};

      for (const name in inputObject) {
        const oldStyleId = mappedUniqueStyleIds[name];
        const newStyleId = mappedUniqueStyleIds[inputObject[name]];

        // check if the styles exist or not, if not notify the user
        if (oldStyleId && newStyleId) {
          mappedObject[oldStyleId] = newStyleId;
        }
      }

      startPluginWithParameters(mappedObject);
    } else {
      notifyUserAndClosePlugin();
    }
  }

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  figma.closePlugin();
};

// <--  helper functions -->

// notify the user about the invalid parameters he/she entered and close the plugin
function notifyUserAndClosePlugin() {
  figma.notify("One of the parameters was not correctly specified. Please try again.");
  figma.closePlugin();
}

// To validate the input whether its a valid JSON are not
function IsJsonString(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

runPlugin();
