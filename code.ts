figma.skipInvisibleInstanceChildren = true;

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
            name: style.name,
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
        return node.setRangeTextStyleId(segment.start, segment.end, newStyleId);
      }
    });
  } else if (node.textStyleId === oldStyleId) {
    return (node.textStyleId = newStyleId);
  }
}

async function startPluginWithParameters(parameters: ParameterValues) {
  if (!parameters["old-style"] || !parameters["new-style"]) {
    figma.notify(
      "One of the parameters was not correctly specified. Please try again."
    );
    figma.closePlugin();
  }
  await allTextNodes.forEach((node) =>
    convertOldToNewStyle(node, parameters["old-style"], parameters["new-style"])
  );
  figma.closePlugin();
}

figma.on("run", async ({ command, parameters }: RunEvent) => {
  if (parameters) {
    await startPluginWithParameters(parameters);
  }
});

async function runPlugin() {
  const ids = await getStyleIdsWithName();

  figma.parameters.on(
    "input",
    async ({ parameters, key, query, result }: ParameterInputEvent) => {  
      switch (key) {
        case "old-style":    
          result.setSuggestions(ids.filter((s) => s.name.includes(query)));
          break;
        case "new-style":
          result.setSuggestions(ids.filter((s) => s.name.includes(query)));
          break;
        default:
          return;
      }
    }
  );

}

runPlugin();