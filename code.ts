figma.skipInvisibleInstanceChildren = true;

// declarations
let uniqueStyleIds = [];
const allTextNodes = figma.root.findAllWithCriteria({
  types: ["TEXT"],
});

let numberOfNotFoundStyleIds = 0;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function showUI() {
  figma.showUI(__html__, { width: 600, height: 300 });
}

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
            name: style.name,
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
  const numberOfNodesUpdated = await convertOldToNewStyle(parameters);
  console.log("STARTED", numberOfNodesUpdated, numberOfNotFoundStyleIds)
  if (numberOfNotFoundStyleIds === 0 && numberOfNodesUpdated > 0) {
    figma.notify(`Updated ${numberOfNodesUpdated} nodes`);
  } else if (numberOfNotFoundStyleIds === 0 && numberOfNodesUpdated === 0) {
    figma.notify(`No matching styles found, make sure all styles are being used in this document`);
  } else if (numberOfNotFoundStyleIds > 0 && numberOfNodesUpdated === 0) {
    figma.notify(`${numberOfNotFoundStyleIds} styles not found`);
  } else {
    figma.notify(`Updated ${numberOfNodesUpdated} nodes, ${numberOfNotFoundStyleIds} styles not found`);
  }
}

figma.on("run", async ({ command, parameters }: RunEvent) => {
  if (parameters) {
    const mappedParameters = {};
    mappedParameters[parameters["old-style"]] = parameters["new-style"];

    await startPluginWithParameters(mappedParameters);
    figma.closePlugin();
  } else {
    showUI();
  }
});

async function runPlugin() {
  const ids = (uniqueStyleIds = await getStyleIdsWithName());

  figma.parameters.on("input", async ({ parameters, key, query, result }: ParameterInputEvent) => {
    switch (key) {
      case "old-style":
        result.setSuggestions(ids.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())));
        break;
      case "new-style":
        result.setSuggestions(ids.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())));
        break;
      default:
        return;
    }
  });
}

figma.ui.onmessage = (msg) => {
  numberOfNotFoundStyleIds = 0;
  console.log("Message", msg)
  if (msg.type === "check-and-update") {
    if (IsJsonString(msg.json)) {
      console.log("IS json")
      const inputObject: ParameterValues = JSON.parse(msg.json);
      const mappedObject = {};

      const mappedUniqueStyleIds: ParameterValues = {};
      uniqueStyleIds.forEach((id: any) => {
        mappedUniqueStyleIds[id.name] = id.data;
      });

      for (const name in inputObject) {
        const oldStyleId = mappedUniqueStyleIds[name];
        const newStyleId = mappedUniqueStyleIds[inputObject[name]];

        // check if the styles exist or not, if not notify the user
        if (oldStyleId && newStyleId) {
          mappedObject[oldStyleId] = newStyleId;
        } else {
          numberOfNotFoundStyleIds += 1;
        }
      }

      startPluginWithParameters(mappedObject);
    }
  } else {
    figma.closePlugin();
  }
};

// <--  helper functions -->


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
