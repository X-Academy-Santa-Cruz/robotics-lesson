const fs = require('fs');
const lines = fs.readFileSync('build_workbook.js','utf8').split('\n');
// [name, pushLine(1-based of "children.push("), closeLine(1-based of ");")]
const map = [
  ['cover',267,282],['toc',285,289],['howto',292,344],['sec1',347,380],
  ['sec2',383,559],['sec3',562,661],['sec4',664,823],['sec5',826,886],
  ['sec6',889,1152],['sec7',1155,1370],['sec8',1373,1448],['sec9',1451,1536],['dashboard',1539,1597],['appendix',1600,1676],['reference',1679,1784],['prompts',1786,1904],
];
let out = '// AUTO-EXTRACTED content blocks from build_workbook.js. Each returns an array.\n';
out += 'module.exports = function(H){\n';
out += '  const { spacer,h1,h2,h3,p,bullet,numbered,b,t,mono,code,callout,checkbox,sectionBanner,atAGlance,twoColTable,threeColTable,buoyancyTable,landscapeBlock,pageBreak,writeLines,figure,imgSize,NAVY,TEAL,ACCENT,AMBER,LIGHT,CODEBG,GREY,Paragraph,TextRun } = H;\n';
out += '  const { PageBreak, HeadingLevel, TableOfContents, AlignmentType, BorderStyle, ShadingType, ImageRun, ExternalHyperlink } = require("docx");\n';
out += '  return {\n';
for (const [name, pushLine, closeLine] of map) {
  // inner = lines after "children.push(" up to before ");"
  // pushLine 1-based; its content is lines[pushLine .. closeLine-2] (0-based)
  const inner = lines.slice(pushLine, closeLine-1).join('\n');
  out += `    ${name}: () => [\n${inner}\n    ],\n`;
}
out += '  };\n};\n';
fs.writeFileSync('wb_content.js', out);
console.log('wb_content.js written', out.split('\n').length, 'lines');
