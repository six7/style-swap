figma.showUI(__html__);
figma.skipInvisibleInstanceChildren = true;

// declarations
let nodesChanged = 0;
let uniqueStyleIds = [];
const allTextNodes = figma.root.findAllWithCriteria({
  types: ["TEXT"],
});

const sleep = ms => new Promise(res => setTimeout(res, ms))

async function getStyleIdsWithName() {
  const uniqueStyleIds = []

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
    if (
      typeof allTextNodes[i].textStyleId === "string" &&
      !uniqueStyleIds.includes(allTextNodes[i].textStyleId)
    ) {
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
async function convertOldToNewStyle(
  node: TextNode,
  oldStyleId: string,
  newStyleId: string
) {
  if (typeof node.textStyleId === "symbol") {
    node.getStyledTextSegments(["textStyleId"]).forEach((segment) => {
      if (segment.textStyleId === oldStyleId) {
        nodesChanged += 1;
        return node.setRangeTextStyleId(segment.start, segment.end, newStyleId);
      }
    });
  } else if (node.textStyleId === oldStyleId) {
    nodesChanged += 1;
    return (node.textStyleId = newStyleId);
  } else if (typeof node.textStyleId === "string" && figma.getStyleById(node.textStyleId)) {
    const oldStyleName = figma.getStyleById(node.textStyleId)?.name.toLowerCase();;

    if (oldStyleName === oldStyleId) {
      const correspondingNewStyleId: any = uniqueStyleIds.filter((s) => s.name.toLowerCase() === newStyleId.toLowerCase());
      if (correspondingNewStyleId[0].data) {
        nodesChanged += 1;
        return (node.textStyleId = correspondingNewStyleId[0].data);
      }
    }
  }
}

async function startPluginWithParameters(parameters: ParameterValues) {
  if (!parameters["old-style"] || !parameters["new-style"]) {
    figma.notify("One of the parameters was not correctly specified. Please try again.");
  }
  await allTextNodes.forEach((node) =>
    convertOldToNewStyle(node, parameters["old-style"], parameters["new-style"])
  );
  figma.notify(`Styles swap done successfully and No. of nodes changed are ${nodesChanged}`);
  figma.closePlugin();
}

async function runPlugin() {
  const ids = uniqueStyleIds = await getStyleIdsWithName();

  figma.parameters.on(
    "input",
    async ({ parameters, key, query, result }: ParameterInputEvent) => {  
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
    }
  );
}

figma.ui.onmessage = (msg) => {
  if (msg.type === "check-and-update") {
    if (IsJsonString(msg.json)) {
      const obj = JSON.parse(msg.json);
      
      for (let eachStyle in obj) {
        startPluginWithParameters({
          "old-style": eachStyle,
          "new-style": obj[eachStyle],
        });
     }
    } else {
      figma.notify("Wrong format. Please try again");
    }    
  }
};

// to validate the input
function IsJsonString(str) {
  try {
      JSON.parse(str);
  } catch (e) {
      return false;
  }
  return true;
}

runPlugin();