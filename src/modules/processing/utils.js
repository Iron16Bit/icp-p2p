//
//  processing-p5-convert.js
//  Copyright (C) 2021 Darren Kessner
//
//  This library is free software; you can redistribute it and/or
//  modify it under the terms of the GNU Lesser General Public
//  License as published by the Free Software Foundation; either
//  version 2.1 of the License, or (at your option) any later version.
//
//  This library is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
//  Lesser General Public License for more details.
//
//  You should have received a copy of the GNU Lesser General Public
//  License along with this library; if not, write to the Free Software
//  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
//

export {
  printRawProcessing,
  printOutlineProcessing,
  transformProcessing,
  reconstructProcessing,
};

import { parse } from "java-parser";

// recursion implementation

function visitChildren(node, level, doSomething, options, context, data) {
  for (const nodeName in node.children) {
    const childArray = node.children[nodeName];

    for (const index in childArray) {
      visitNodesRecursive(
        childArray[index],
        level,
        doSomething,
        options,
        context,
        data
      );
    }
  }
}

function visitNodesRecursive(node, level, doSomething, options, context, data) {
  if ("leadingComments" in node)
    for (const index in node.leadingComments)
      visitNodesRecursive(
        node.leadingComments[index],
        level,
        doSomething,
        options,
        { ...context, isComment: true },
        data
      );

  const shouldRecurse = doSomething(node, level, options, context, data);

  if (shouldRecurse)
    visitChildren(node, level + 1, doSomething, options, context, data);

  if ("trailingComments" in node)
    for (const index in node.trailingComments)
      visitNodesRecursive(
        node.trailingComments[index],
        level,
        doSomething,
        options,
        { ...context, isComment: true },
        data
      );
}

// raw code extraction

function cstPrintRawVisitor(node, level, options, context, data) {
  if ("name" in node) console.log(" ".repeat(level) + node.name);
  else if ("image" in node) console.log(" ".repeat(level) + node.image);

  return true;
}

const cstPrintRaw = (cst) =>
  visitNodesRecursive(cst, 0, cstPrintRawVisitor, null, null, null);

function printRawProcessing(code) {
  const preprocessed = preprocessProcessing(code);
  const cst = parse(preprocessed);
  cstPrintRaw(cst);
}

// name extraction from a class

function cstExtractClassNamesVisitor(node, level, options, context, result) {
  if ("image" in node) {
    if (context.typeIdentifier === true) {
      result.className = node.image;
    }
    if (
      context.fieldDeclaration === true &&
      context.variableDeclaratorId === true
    ) {
      if (context.isStatic === true) result.staticFieldNames.push(node.image);
      else result.fieldNames.push(node.image);
    } else if (
      context.methodDeclaration === true &&
      context.methodDeclarator === true
    ) {
      if (node.tokenType.name === "Identifier")
        result.methodNames.push(node.image);
    } else if (context.fieldModifier === true) {
      if (node.image === "static") context.isStatic = true;
    }
  }

  if (!("name" in node)) return true;

  if (node.name === "typeIdentifier") {
    visitChildren(
      node,
      level + 1,
      cstExtractClassNamesVisitor,
      options,
      { ...context, typeIdentifier: true },
      result
    );
    return false;
  } else if (node.name === "fieldDeclaration") {
    visitChildren(
      node,
      level + 1,
      cstExtractClassNamesVisitor,
      options,
      { ...context, fieldDeclaration: true },
      result
    );
    return false;
  } else if (node.name === "fieldModifier") {
    let newContext = { ...context, fieldModifier: true };

    visitChildren(
      node,
      level + 1,
      cstExtractClassNamesVisitor,
      options,
      newContext,
      result
    );

    if (newContext.isStatic === true) context.isStatic = true;

    return false;
  } else if (
    node.name === "variableDeclaratorId" &&
    context.fieldDeclaration === true
  ) {
    visitChildren(
      node,
      level + 1,
      cstExtractClassNamesVisitor,
      options,
      { ...context, variableDeclaratorId: true },
      result
    );
    return false;
  } else if (node.name === "methodDeclaration") {
    visitChildren(
      node,
      level + 1,
      cstExtractClassNamesVisitor,
      options,
      { ...context, methodDeclaration: true },
      result
    );
    return false;
  } else if (
    node.name === "methodDeclarator" &&
    context.methodDeclaration === true
  ) {
    visitChildren(
      node,
      level + 1,
      cstExtractClassNamesVisitor,
      options,
      { ...context, methodDeclarator: true },
      result
    );
    return false;
  } else if (node.name === "formalParameterList") {
    return false;
  }

  return true;
}

function cstExtractClassNames(cst) {
  let result = {
    className: "Unknown",
    fieldNames: [],
    staticFieldNames: [],
    methodNames: [],
  };

  visitNodesRecursive(cst, 0, cstExtractClassNamesVisitor, null, {}, result);

  return result;
}

// special node handlers for extractCodeVisitor()

//
// variableDeclaratorList: "mouseX, mouseY"
//  - variableDeclarator: [mouseX, mouseY]
//  - Comma: [\,]
//
// fqnOrRefType: "System.out.println"
//  - fqnOrRefTypePartFirst: "System"
//  - fqnOrRefTypePartRest: ["out", "println"]
//  - Dot: [".", "."]
//
// binaryExpression: "x < width + 10"
//  - unaryExpression: [x, width, 10]
//  - BinaryOperator: [<, +]
//
// argumentList: "(420, 666)"
//  - expression: [420, 666]
//  - Comma: [\,]
//

function visitChildrenInterleaved(
  node,
  zeroth,
  first,
  second,
  level,
  options,
  context,
  result
) {
  // visit zeroth

  if (zeroth && zeroth in node.children)
    visitNodesRecursive(
      node.children[zeroth][0],
      level + 1,
      extractCodeVisitor,
      options,
      context,
      result
    );

  // interleave first and second

  let firstArray = first in node.children ? node.children[first] : null;
  if (!firstArray) return;

  let secondArray = second in node.children ? node.children[second] : null;

  for (const index in firstArray) {
    visitNodesRecursive(
      firstArray[index],
      level + 1,
      extractCodeVisitor,
      options,
      context,
      result
    );
    if (secondArray !== null && index in secondArray)
      visitNodesRecursive(
        secondArray[index],
        level + 1,
        extractCodeVisitor,
        options,
        context,
        result
      );
  }
}

function extractCodeVisitor_basicForStatement(
  node,
  level,
  options,
  context,
  data
) {
  const ok =
    "For" in node.children &&
    "LBrace" in node.children &&
    "RBrace" in node.children &&
    "Semicolon" in node.children &&
    node.children.Semicolon.length === 2 &&
    "expression" in node.children &&
    "forInit" in node.children &&
    "forUpdate" in node.children &&
    "statement" in node.children;

  if (!ok) {
    console.log("[processing-p5-convert] handle_basicForStatement not ok");
    return;
  }

  visitNodesRecursive(
    node.children.For[0],
    level + 1,
    extractCodeVisitor,
    options,
    context,
    data
  );
  visitNodesRecursive(
    node.children.LBrace[0],
    level + 1,
    extractCodeVisitor,
    options,
    context,
    data
  );
  visitNodesRecursive(
    node.children.forInit[0],
    level + 1,
    extractCodeVisitor,
    options,
    context,
    data
  );
  visitNodesRecursive(
    node.children.Semicolon[0],
    level + 1,
    extractCodeVisitor,
    options,
    context,
    data
  );
  visitNodesRecursive(
    node.children.expression[0],
    level + 1,
    extractCodeVisitor,
    options,
    context,
    data
  );
  visitNodesRecursive(
    node.children.Semicolon[1],
    level + 1,
    extractCodeVisitor,
    options,
    context,
    data
  );
  visitNodesRecursive(
    node.children.forUpdate[0],
    level + 1,
    extractCodeVisitor,
    options,
    context,
    data
  );
  visitNodesRecursive(
    node.children.RBrace[0],
    level + 1,
    extractCodeVisitor,
    options,
    context,
    data
  );
  visitNodesRecursive(
    node.children.statement[0],
    level + 1,
    extractCodeVisitor,
    options,
    context,
    data
  );

  return false;
}

function extractCodeVisitor_ifStatement(node, level, options, context, data) {
  const ok =
    "If" in node.children &&
    "LBrace" in node.children &&
    "RBrace" in node.children &&
    "expression" in node.children &&
    "statement" in node.children;

  if (!ok) {
    console.log("[processing-p5-convert] handle_ifStatement not ok");
    return;
  }

  visitNodesRecursive(
    node.children.If[0],
    level + 1,
    extractCodeVisitor,
    options,
    context,
    data
  );
  visitNodesRecursive(
    node.children.LBrace[0],
    level + 1,
    extractCodeVisitor,
    options,
    context,
    data
  );
  visitNodesRecursive(
    node.children.expression[0],
    level + 1,
    extractCodeVisitor,
    options,
    context,
    data
  );
  visitNodesRecursive(
    node.children.RBrace[0],
    level + 1,
    extractCodeVisitor,
    options,
    context,
    data
  );
  visitNodesRecursive(
    node.children.statement[0],
    level + 1,
    extractCodeVisitor,
    options,
    context,
    data
  );

  if ("Else" in node.children) {
    visitNodesRecursive(
      node.children.Else[0],
      level + 1,
      extractCodeVisitor,
      options,
      context,
      data
    );
    visitNodesRecursive(
      node.children.statement[1],
      level + 1,
      extractCodeVisitor,
      options,
      context,
      data
    );
  }

  return false;
}

function registerField(node, context, result) {
  const ok =
    "unannType" in node.children && "variableDeclaratorList" in node.children;

  if (!ok) {
    console.log("[processing-p5-convert] registerField not ok");
    return;
  }

  const tempOptions = {
    transform: false,
    ignoreOuterClass: false,
  };

  const type = cstExtractCode(node.children.unannType[0], tempOptions);

  if (type.startsWith("ArrayList")) {
    result.arrayListReference = true;
  }
}

// visitor for cstExtractCode

function extractCodeVisitor_image(node, level, options, context, result) {
  if (options.transform === true) {
    // transform:  member variables in class method body x -> this.x

    if (
      context.methodBody === true &&
      context.primaryPrefix === true &&
      "fieldNames" in context &&
      "methodNames" in context
    ) {
      let isLocal =
        "parameterNames" in context &&
        context.parameterNames.includes(node.image);

      let isMember =
        context.fieldNames.includes(node.image) ||
        context.methodNames.includes(node.image);

      let isStatic = context.staticFieldNames.includes(node.image);

      if (isLocal === false && context.fqnOrRefTypePartRest !== true) {
        if (isMember === true) {
          result.code += "this." + node.image + " ";
          return false;
        } else if (isStatic === true) {
          result.code += context.className + "." + node.image + " ";
          return false;
        }
      }
    }

    // transform: for each loop : -> of
    else if (context.enhancedForStatement === true && node.image === ":") {
      result.code += "of ";
      return false;
    }

    // transform variable declarator list inside class:
    //   int a, b, c; ->  a; b; c;
    else if (
      context.classDeclaration === true &&
      context.variableDeclaratorList === true &&
      context.variableDeclarator !== true &&
      node.image == ","
    ) {
      result.code += ";";
      return false;
    }
  }

  // default: actual code string is stored in node.image

  result.code += node.image;

  if (context.isComment === true) result.code += "\n";
  else result.code += " ";

  return true;
}

function extractCodeVisitor_fqnOrRefTypePartRest(
  node,
  level,
  options,
  context,
  result
) {
  visitChildren(
    node,
    level + 1,
    extractCodeVisitor,
    options,
    { ...context, fqnOrRefTypePartRest: true },
    result
  );

  return false;
}

function extractCodeVisitor_fqnOrRefType(
  node,
  level,
  options,
  context,
  result
) {
  let temp = { code: "" };

  visitChildrenInterleaved(
    node,
    "fqnOrRefTypePartFirst",
    "Dot",
    "fqnOrRefTypePartRest",
    level + 1,
    options,
    context,
    temp
  );

  temp.code = temp.code.trim();

  if (options.transform) {
    if (temp.code === "size") temp.code = "createCanvas";
    else if (temp.code === "P3D") {
      temp.code = "WEBGL";
      context.webgl = true;
    } else if (temp.code === "pushMatrix") temp.code = "push";
    else if (temp.code === "popMatrix") temp.code = "pop";
    else if (temp.code === "println") temp.code = "console.log";
    else if (temp.code === "print") temp.code = "console.log";
    else if (temp.code === "UP") temp.code = "UP_ARROW";
    else if (temp.code === "DOWN") temp.code = "DOWN_ARROW";
    else if (temp.code === "RIGHT") temp.code = "RIGHT_ARROW";
    else if (temp.code === "LEFT") temp.code = "LEFT_ARROW";
    else if (context.insideSetup === true && temp.code.startsWith("load"))
      context.isLoadFile = true;
    else if (temp.code === "createFont") {
      temp.code = "loadFont";
      context.isLoadFile = true;
      context.isCreateFont = true;
    }
  }

  result.code += temp.code;

  return false;
}

function extractCodeVisitor_argumentList(
  node,
  level,
  options,
  context,
  result
) {
  let temp = { code: "" };

  visitChildrenInterleaved(
    node,
    "",
    "expression",
    "Comma",
    level + 1,
    options,
    context,
    temp
  );

  if (options.transform === true) {
    if (context.isCreateFont === true) {
      // transform: truncate argumentList in createFont
      //  createFont("filename.otf",24) -> loadFont("filename.otf")
      let comma = temp.code.indexOf(",");
      temp.code = temp.code.slice(0, comma);
      context.isCreateFont = false;
    }
  }

  result.code += temp.code;

  return false;
}

function extractCodeVisitor_variableDeclaratorList(
  node,
  level,
  options,
  context,
  result
) {
  visitChildrenInterleaved(
    node,
    "",
    "variableDeclarator",
    "Comma",
    level + 1,
    options,
    { ...context, variableDeclaratorList: true },
    result
  );
  return false;
}

function extractCodeVisitor_variableDeclarator(
  node,
  level,
  options,
  context,
  result
) {
  visitChildren(
    node,
    level + 1,
    extractCodeVisitor,
    options,
    { ...context, variableDeclarator: true },
    result
  );
  return false;
}

function extractCodeVisitor_variableInitializerList(
  node,
  level,
  options,
  context,
  result
) {
  visitChildrenInterleaved(
    node,
    "",
    "variableInitializer",
    "Comma",
    level + 1,
    options,
    context,
    result
  );
  return false;
}

function extractCodeVisitor_result(node, level, options, context, result) {
  // transform function result type depending on context
  // - global:  void/int/... -> function
  // - class: void/int/... -> ""

  if (options.transform === true) {
    if (context.classDeclaration !== true) {
      result.code += "function ";
    }
    return false;
  }

  return true;
}

function extractCodeVisitor_binaryExpression(
  node,
  level,
  options,
  context,
  result
) {
  if ("BinaryOperator" in node.children) {
    visitChildrenInterleaved(
      node,
      "",
      "unaryExpression",
      "BinaryOperator",
      level + 1,
      options,
      context,
      result
    );
    return false;
  }

  return true;
}

function extractCodeVisitor_ternaryExpression(
  node,
  level,
  options,
  context,
  result
) {
  if ("QuestionMark" in node.children) {
    // handle ternary operator ( a ? b : c )

    const ok =
      "binaryExpression" in node.children &&
      "Colon" in node.children &&
      "expression" in node.children &&
      node.children.expression.length === 2;

    if (!ok) {
      console.log("[processing-p5-convert] handle_ternaryExpression not ok");
      return true;
    }

    visitNodesRecursive(
      node.children.binaryExpression[0],
      level + 1,
      extractCodeVisitor,
      options,
      context,
      result
    );
    visitNodesRecursive(
      node.children.QuestionMark[0],
      level + 1,
      extractCodeVisitor,
      options,
      context,
      result
    );
    visitNodesRecursive(
      node.children.expression[0],
      level + 1,
      extractCodeVisitor,
      options,
      context,
      result
    );
    visitNodesRecursive(
      node.children.Colon[0],
      level + 1,
      extractCodeVisitor,
      options,
      context,
      result
    );
    visitNodesRecursive(
      node.children.expression[1],
      level + 1,
      extractCodeVisitor,
      options,
      context,
      result
    );

    return false;
  }

  return true;
}

function extractCodeVisitor_enhancedForStatement(
  node,
  level,
  options,
  context,
  result
) {
  visitChildren(
    node,
    level + 1,
    extractCodeVisitor,
    options,
    { ...context, enhancedForStatement: true },
    result
  );
  return false;
}

function extractCodeVisitor_fieldDeclaration(
  node,
  level,
  options,
  context,
  result
) {
  visitChildren(
    node,
    level + 1,
    extractCodeVisitor,
    options,
    { ...context, fieldDeclaration: true },
    result
  );

  if (options.transform === true) registerField(node, context, result);

  return false;
}

function extractCodeVisitor_localVariableDeclaration(
  node,
  level,
  options,
  context,
  result
) {
  visitChildren(
    node,
    level + 1,
    extractCodeVisitor,
    options,
    { ...context, localVariableDeclaration: true },
    result
  );

  return false;
}

function extractCodeVisitor_fieldModifier(
  node,
  level,
  options,
  context,
  result
) {
  if (options.transform === true) {
    // transform: remove any field modifiers (e.g. public, final) except
    // static

    let temp = { code: "" };
    visitChildren(node, level + 1, extractCodeVisitor, options, options, temp);
    let modifier = temp.code.trim();

    if (modifier === "static") result.code += temp.code;

    return false;
  }

  return true;
}

function extractCodeVisitor_unannType(node, level, options, context, result) {
  if (options.transform) {
    // transform field declarations depending on context:
    // - global: int/float/... -> let
    // - class:  int/float/... -> ""

    if (
      (context.classDeclaration !== true &&
        context.formalParameterList !== true) ||
      context.localVariableDeclaration === true
    )
      result.code += "let ";

    return false;
  }

  return true;
}

function extractCodeVisitor_classDeclaration(
  node,
  level,
  options,
  context,
  result
) {
  let { className, fieldNames, staticFieldNames, methodNames } =
    cstExtractClassNames(node);

  let newContext = {
    ...context,
    className,
    fieldNames,
    staticFieldNames,
    methodNames,
    classDeclaration: true,
  };

  visitChildren(
    node,
    level + 1,
    extractCodeVisitor,
    options,
    newContext,
    result
  );
  return false;
}

function extractCodeVisitor_constructorDeclaration(
  node,
  level,
  options,
  context,
  result
) {
  if (options.transform === true && context.hasConstructor === true) {
    // transform: comment out multiple constructors

    let temp = { code: "" };

    visitChildren(
      node,
      level + 1,
      extractCodeVisitor,
      options,
      { ...context, constructorDeclaration: true },
      temp
    );

    result.code += "/*" + temp.code + "*/";
    return false;
  } else {
    visitChildren(
      node,
      level + 1,
      extractCodeVisitor,
      options,
      { ...context, constructorDeclaration: true },
      result
    );
    context.hasConstructor = true;
    return false;
  }
}

function extractCodeVisitor_methodBody(node, level, options, context, result) {
  if (context.classDeclaration === true) {
    visitChildren(
      node,
      level + 1,
      extractCodeVisitor,
      options,
      { ...context, methodBody: true },
      result
    );
    return false;
  }

  return true;
}

function extractCodeVisitor_simpleTypeName(
  node,
  level,
  options,
  context,
  result
) {
  if (options.transform === true && context.constructorDeclaration === true) {
    result.code += "constructor"; // transform: ClassName() -> constructor()
    return false;
  }

  return true;
}

function extractCodeVisitor_newExpression(
  node,
  level,
  options,
  context,
  result
) {
  if (options.transform === true) {
    if (
      "unqualifiedClassInstanceCreationExpression" in node.children &&
      "classOrInterfaceTypeToInstantiate" in
        node.children.unqualifiedClassInstanceCreationExpression[0].children
    ) {
      let className = { code: "" };
      let start =
        node.children.unqualifiedClassInstanceCreationExpression[0].children
          .classOrInterfaceTypeToInstantiate[0];
      visitNodesRecursive(
        start,
        level + 1,
        extractCodeVisitor,
        options,
        context,
        className
      );

      if (className.code.startsWith("ArrayList")) {
        // transform: ArrayList<ClassName> -> ArrayList
        result.code += "new ArrayList()";
        return false;
      } else if (className.code.startsWith("PVector")) {
        // transform: new PVector -> new p5.Vector
        let temp = { code: "" };
        visitChildren(
          node,
          level + 1,
          extractCodeVisitor,
          options,
          context,
          temp
        );
        temp.code = temp.code.replace("PVector", "p5.Vector");
        result.code += temp.code;
        return false;
      } else if (className.code.startsWith("SoundFile")) {
        // transform: new SoundFile(this, "filename.wav") -> loadSound("filename.wav")

        let filename = { code: "" };

        let start =
          node.children.unqualifiedClassInstanceCreationExpression[0].children
            .argumentList[0].children.expression[1];

        visitNodesRecursive(
          start,
          level + 1,
          extractCodeVisitor,
          {},
          context,
          filename
        );

        result.code += "loadSound(" + filename.code + ")";
        context.isLoadFile = true;

        return false;
      }
    } else if ("arrayCreationExpression" in node.children) {
      let start =
        node.children.arrayCreationExpression[0].children
          .arrayCreationDefaultInitSuffix[0];

      let newContext = {
        ...context,
        arrayCreationExpression: true,
      };

      let temp = { code: "", dimensions: [] };

      visitNodesRecursive(
        start,
        level + 1,
        extractCodeVisitor,
        {},
        newContext,
        temp
      );

      if (temp.dimensions.length === 1) {
        result.code += "new Array(" + temp.dimensions[0] + ")";
      } else if (temp.dimensions.length === 2) {
        let [m, n] = temp.dimensions;
        result.code += `Array.from(new Array(${m}), ()=>new Array(${n}))`;
      } else {
        console.log(
          "[processing-p5-convert] newExpression array bad dimensions.length:" +
            temp.dimensions.length
        );
      }

      return false;
    }
  }

  return true;
}

function extractCodeVisitor_methodDeclaration(
  node,
  level,
  options,
  context,
  result
) {
  let newContext = { ...context, methodDeclaration: true };

  visitChildren(
    node,
    level + 1,
    extractCodeVisitor,
    options,
    newContext,
    result
  );

  if (options.transform === true && newContext.insideSetup === true) {
    if (newContext.preload)
      result.code += "function preload() {" + newContext.preload + "}";

    if (newContext.webgl === true) context.webgl = true; // propagate to outer context
  }

  return false;
}

function extractCodeVisitor_methodDeclarator(
  node,
  level,
  options,
  context,
  result
) {
  if (context.classDeclaration !== true && context.methodDeclaration === true) {
    const methodName = node.children.Identifier[0].image;

    if (methodName === "setup") {
      context.insideSetup = true; // add more context: inside setup()
      context.preload = "";
    } else if (methodName === "draw" && context.webgl === true) {
      context.insideDraw = true;
    }
  }

  return true;
}

function extractCodeVisitor_blockStatement(
  node,
  level,
  options,
  context,
  result
) {
  if (context.insideSetup === true) {
    let temp = { code: "" };
    visitChildren(node, level + 1, extractCodeVisitor, options, context, temp);

    if (context.isLoadFile === true) {
      // hack for font string transformation:
      //      courier = createFont("Courier", 24); ->
      //      courier = "Courier";

      let regex_isLoadFont = /loadFont/;
      let regex_isFilename = /\".+\.[a-z]{3}\"/i;

      let matchesLoadFont = temp.code.match(regex_isLoadFont);
      let matchesFilename = temp.code.match(regex_isFilename);

      if (matchesLoadFont && !matchesFilename) {
        temp.code = temp.code.replace(/loadFont.*\(/, "");
        temp.code = temp.code.replace(")", "");
      }

      // save load*() statements to put in preload()

      context.preload += temp.code;
      context.isLoadFile = false;
    } else {
      // default: leave statement in setup()

      result.code += temp.code;
    }

    return false;
  }

  return true;
}

function extractCodeVisitor_blockStatements(
  node,
  level,
  options,
  context,
  result
) {
  if (context.webgl === true && context.insideDraw === true) {
    result.code += "translate(-width/2, -height/2); ";
    context.webgl = false; // only transform once, at the top of draw(){}
  }

  return true;
}

function extractCodeVisitor_formalParameterList(
  node,
  level,
  options,
  context,
  result
) {
  let temp = { code: "" };

  visitChildrenInterleaved(
    node,
    "",
    "formalParameter",
    "Comma",
    level + 1,
    options,
    { ...context, formalParameterList: true },
    temp
  );

  // save parameter names
  context.parameterNames = temp.code.split(",").map((s) => s.trim());

  result.code += temp.code;

  return false;
}

function extractCodeVisitor_primitiveCastExpression(
  node,
  level,
  options,
  context,
  result
) {
  if (options.transform === true) {
    if ("unaryExpression" in node.children) {
      // transform: "(float) x" -> "x"
      visitNodesRecursive(
        node.children.unaryExpression[0],
        level + 1,
        extractCodeVisitor,
        options,
        context,
        result
      );
      return false;
    }
  }

  return true;
}

function extractCodeVisitor_primaryPrefix(
  node,
  level,
  options,
  context,
  result
) {
  if (options.transform === true && context.methodBody === true) {
    visitChildren(
      node,
      level + 1,
      extractCodeVisitor,
      options,
      { ...context, primaryPrefix: true },
      result
    );
    return false;
  }

  return true;
}

function extractCodeVisitor_arrayInitializer(
  node,
  level,
  options,
  context,
  result
) {
  if (options.transform === true) {
    // transform: array literal {1, 2, 3, 4} -> [1, 2, 3, 4]
    let temp = { code: "" };
    visitChildren(node, level + 1, extractCodeVisitor, options, context, temp);
    temp.code = temp.code.replace("{", "[");
    temp.code = temp.code.replace("}", "]");
    result.code += temp.code;
    return false;
  }

  return true;
}

function extractCodeVisitor_dims(node, level, options, context, result) {
  visitChildrenInterleaved(
    node,
    "",
    "LSquare",
    "RSquare",
    level + 1,
    options,
    context,
    result
  );
  return false;
}

function extractCodeVisitor_expression(node, level, options, context, result) {
  if (context.arrayCreationExpression === true && "dimensions" in result) {
    let temp = { code: "" };
    visitChildren(node, level + 1, extractCodeVisitor, options, context, temp);
    result.dimensions.push(temp.code.trim());
    return false;
  }

  return true;
}

function extractCodeVisitor_floatingPointLiteral(
  node,
  level,
  options,
  context,
  result
) {
  if (options.transform === true) {
    let number = node.children.FloatLiteral[0].image;
    if (number.slice(-1) === "f") number = number.slice(0, -1); // remove the trailing 'f'
    result.code += number;
    return false;
  }

  return true;
}

// extractCodeVisitor special handler table

const extractCodeVisitor_specialHandlers = {
  fqnOrRefType: extractCodeVisitor_fqnOrRefType,
  fqnOrRefTypePartRest: extractCodeVisitor_fqnOrRefTypePartRest,
  argumentList: extractCodeVisitor_argumentList,
  variableDeclaratorList: extractCodeVisitor_variableDeclaratorList,
  variableDeclarator: extractCodeVisitor_variableDeclarator,
  variableInitializerList: extractCodeVisitor_variableInitializerList,
  result: extractCodeVisitor_result,
  binaryExpression: extractCodeVisitor_binaryExpression,
  ternaryExpression: extractCodeVisitor_ternaryExpression,
  basicForStatement: extractCodeVisitor_basicForStatement,
  ifStatement: extractCodeVisitor_ifStatement,
  enhancedForStatement: extractCodeVisitor_enhancedForStatement,
  fieldDeclaration: extractCodeVisitor_fieldDeclaration,
  localVariableDeclaration: extractCodeVisitor_localVariableDeclaration,
  fieldModifier: extractCodeVisitor_fieldModifier,
  variableModifier: extractCodeVisitor_fieldModifier, // same as fieldModifier
  classModifier: extractCodeVisitor_fieldModifier, // same as fieldModifier
  methodModifier: extractCodeVisitor_fieldModifier, // same as fieldModifier
  constructorModifier: extractCodeVisitor_fieldModifier, // same as fieldModifier
  unannType: extractCodeVisitor_unannType,
  classDeclaration: extractCodeVisitor_classDeclaration,
  constructorDeclaration: extractCodeVisitor_constructorDeclaration,
  methodBody: extractCodeVisitor_methodBody,
  constructorBody: extractCodeVisitor_methodBody, // same as methodBody
  simpleTypeName: extractCodeVisitor_simpleTypeName,
  newExpression: extractCodeVisitor_newExpression,
  methodDeclaration: extractCodeVisitor_methodDeclaration,
  methodDeclarator: extractCodeVisitor_methodDeclarator,
  blockStatement: extractCodeVisitor_blockStatement,
  blockStatements: extractCodeVisitor_blockStatements,
  formalParameterList: extractCodeVisitor_formalParameterList,
  primitiveCastExpression: extractCodeVisitor_primitiveCastExpression,
  primaryPrefix: extractCodeVisitor_primaryPrefix,
  arrayInitializer: extractCodeVisitor_arrayInitializer,
  dims: extractCodeVisitor_dims,
  expression: extractCodeVisitor_expression,
  floatingPointLiteral: extractCodeVisitor_floatingPointLiteral,
};

// primary extractCodeVisitor entry point

function extractCodeVisitor(node, level, options, context, result) {
  if ("image" in node)
    return extractCodeVisitor_image(node, level, options, context, result);

  if ("name" in node && node.name in extractCodeVisitor_specialHandlers)
    return extractCodeVisitor_specialHandlers[node.name](
      node,
      level,
      options,
      context,
      result
    );

  return true;
}

// helper functions

function getClassBody(node, level, options, context, data) {
  if ("name" in node && node.name == "classBody") {
    data["node"] = node;
    return false;
  }
  return true;
}

function getClassBodyNode(cst) {
  let classBody = {};
  visitNodesRecursive(cst, 0, getClassBody, null, null, classBody);
  return classBody.node;
}

// main entry function to visit cst

function cstExtractCode(cst, options) {
  let root = cst;
  let context = {};
  let result = { code: "" };

  if (options.ignoreOuterClass) root = getClassBodyNode(cst);

  visitNodesRecursive(
    root,
    0,
    extractCodeVisitor,
    options,
    { ...context, noHeader: true },
    result
  );

  if (options.ignoreOuterClass) result.code = result.code.trim().slice(1, -1); // remove braces

  if (
    options.transform === true &&
    !context.noHeader &&
    result.arrayListReference === true
  )
    result.code = arrayListDeclaration + result.code;

  return result.code;
}

function cstPrintOutlineVisitor(node, level, options, context, result) {
  if (!("name" in node)) return true;

  if (node.name === "fieldDeclaration") {
    const tempOptions = {
      transform: false,
      ignoreOuterClass: false,
    };

    let code = cstExtractCode(node, tempOptions);

    console.log(code);

    return false;
  }

  return true;
}

const cstPrintOutline = (cst) =>
  visitNodesRecursive(cst, 0, cstPrintOutlineVisitor, null, null, null);

function printOutlineProcessing(code) {
  const wrapped = "public class Dummy {" + code + "}";
  const cst = parse(wrapped);
  cstPrintOutline(cst);
}

const arrayListDeclaration = `
class ArrayList extends Array {
    constructor() {super(...[]);}
    size() {return this.length;}
    add(x) {this.push(x);}
    get(i) {return this[i];}
    remove(i) {this.splice(i,1);}
}
`;

function preprocessProcessing(code) {
  // Remove from code anything that comes after "//"
  code = code.replace(/\/\/.*/g, "");

  // Remove from code any block that starts with "/*" and ends with "*/"
  code = code.replace(/\/\*[\s\S]*?\*\//g, "");

  // If there is a variable called "size", replace its name with "sz". But only if it's not a function call size()
  code = code.replace(/\bsize\b(?!\s*\([^,\n]*,[^,\n]*\))/g, "sz");

  // If a variable mousePressed is used in the code, replace it with mouseIsPressed. But only if it's not a function call mousePressed()
  code = code.replace(/\bmousePressed\b(?![^\n(]*\))/g, "mouseIsPressed");

  // Convert java casting to processing casting
  const regexCasting =
    /\(\s*(int|float|double|char|byte|boolean)\s*\)\s*(\w+)\s*\(([^\)]*)\)/g;
  code = code.replace(regexCasting, "$1($2($3))");

  // Check if code has a string setup() or any combination of setup, ( and ) with white spaces between them
  // The same for draw
  const regexSetup = /setup\s*\(\s*\)/;
  const regexDraw = /draw\s*\(\s*\)/;

  // if the code does not contain the setup function, add it
  if (!regexSetup.test(code)) {
    if (regexDraw.test(code)) {
      code = "void setup () {}\n" + code;
    } else {
      code = `void setup() { ${code} }`;
    }
  }

  let wrapped = "public class Dummy {" + code + "}";

  // hack: Processing allows int/color literals of the form #ff1234 (6 digits
  // exactly), but Processing literals are not valid Java, and java-parser
  // chokes on them.  Also, p5.js uses strings.  So we quote all Processing
  // color literals before parsing.

  const regex_hex = /#[0-9A-Fa-f]{6}/g;
  wrapped = wrapped.replace(regex_hex, '"$&"');

  // comment out import statements

  const regex_import = /import/g;
  wrapped = wrapped.replace(regex_import, "// [processing-p5-convert] $&");

  return wrapped;
}

function unpreprocessProcessing(code) {
  // undo the regex transformations (but not the outer Dummy class (for now?))

  // we quote Processing color literals in preprocessProcessing, so
  // we need to un-quote for round-trip back to valid Processing code

  const regex_quoted_hex = /\"#[0-9A-Fa-f]{6}\"/g;
  code = code.replace(regex_quoted_hex, (s) => s.substring(1, s.length - 1));

  // uncomment imports

  const regex_soundFile = /\/\/ \[processing-p5-convert\] import /g;
  let matches = code.match(regex_soundFile);
  if (matches) code = code.replace(regex_soundFile, "import ");

  return code;
}

function transformProcessing(code) {
  const preprocessed = preprocessProcessing(code);
  const cst = parse(preprocessed);

  const options = {
    transform: true,
    ignoreOuterClass: true,
  };

  let output = cstExtractCode(cst, options);

  return output;
}

function reconstructProcessing(code) {
  const preprocessed = preprocessProcessing(code);
  const cst = parse(preprocessed);

  const options = {
    transform: false,
    ignoreOuterClass: true,
  };

  let output = cstExtractCode(cst, options);

  // TODO: merge the 2 wrapper hacks
  const dummyPrefix = "{";
  const dummySuffix = "}";
  output = dummyPrefix + output + dummySuffix;
  output = output.slice(dummyPrefix.length, -dummySuffix.length);
  output = output.replace(/^\s*/g, "");
  output = output.replace(/\n    /g, "\n");

  return unpreprocessProcessing(output);
}

if (typeof module !== "undefined") {
  module.exports = {
    printRawProcessing,
    printOutlineProcessing,
    transformProcessing,
    reconstructProcessing,
  };

  console.log("processing-p5js-convert");
}
