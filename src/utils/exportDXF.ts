// DXF R12 export — compatible with EzCad and RDWorks
// Black layer (CORTE): outer border cut
// Red layer (GRAVACAO): inner border, divider, name, profession

interface DXFLine { x1: number; y1: number; x2: number; y2: number }
interface DXFArc  { cx: number; cy: number; r: number; startAngle: number; endAngle: number }
interface DXFText { x: number; y: number; text: string; height: number; style?: string }

// DXF color ACI codes
const COLOR_BLACK = 7  // layer 7 = white on black BG, but machines use as "black"
const COLOR_RED   = 1  // red = engrave layer in EzCad/RDWorks

type Entity =
  | { kind: 'line'; data: DXFLine; layer: string; color: number }
  | { kind: 'arc';  data: DXFArc;  layer: string; color: number }
  | { kind: 'text'; data: DXFText; layer: string; color: number }

const entities: Entity[] = []

function dxfLine(d: DXFLine, layer: string, color: number): string {
  return [
    '0', 'LINE',
    '8', layer,
    '62', String(color),
    '10', d.x1.toFixed(4),
    '20', d.y1.toFixed(4),
    '30', '0.0',
    '11', d.x2.toFixed(4),
    '21', d.y2.toFixed(4),
    '31', '0.0',
  ].join('\n')
}

function dxfArc(d: DXFArc, layer: string, color: number): string {
  return [
    '0', 'ARC',
    '8', layer,
    '62', String(color),
    '10', d.cx.toFixed(4),
    '20', d.cy.toFixed(4),
    '30', '0.0',
    '40', d.r.toFixed(4),
    '50', d.startAngle.toFixed(4),
    '51', d.endAngle.toFixed(4),
  ].join('\n')
}

function dxfText(d: DXFText, layer: string, color: number): string {
  return [
    '0', 'TEXT',
    '8', layer,
    '62', String(color),
    '10', d.x.toFixed(4),
    '20', d.y.toFixed(4),
    '30', '0.0',
    '40', d.height.toFixed(4),
    '72', '1',  // horizontal center
    '1', d.text,
    '11', d.x.toFixed(4),
    '21', d.y.toFixed(4),
    '31', '0.0',
  ].join('\n')
}

// SVG Y → DXF Y (flip vertical, broche is 25mm tall)
function flipY(svgY: number): number {
  return 25 - svgY
}

// Decompose a rounded rect into lines + arcs for DXF
// (x,y) = DXF bottom-left, width, height, rx = corner radius
function roundedRectEntities(
  svgX: number, svgY: number,
  w: number, h: number, rx: number,
  layer: string, color: number,
): string[] {
  // convert to DXF coords
  const x = svgX
  const y = flipY(svgY + h)  // DXF bottom-left y
  const lines: DXFLine[] = [
    { x1: x + rx,   y1: y + h,      x2: x + w - rx, y2: y + h      }, // top
    { x1: x + w,    y1: y + h - rx, x2: x + w,      y2: y + rx     }, // right
    { x1: x + w - rx, y1: y,        x2: x + rx,     y2: y          }, // bottom
    { x1: x,        y1: y + rx,     x2: x,          y2: y + h - rx }, // left
  ]
  // Arcs (counterclockwise in DXF, Y-up)
  const arcs: DXFArc[] = [
    { cx: x + w - rx, cy: y + h - rx, r: rx, startAngle: 0,   endAngle: 90  }, // top-right
    { cx: x + rx,     cy: y + h - rx, r: rx, startAngle: 90,  endAngle: 180 }, // top-left
    { cx: x + rx,     cy: y + rx,     r: rx, startAngle: 180, endAngle: 270 }, // bottom-left
    { cx: x + w - rx, cy: y + rx,     r: rx, startAngle: 270, endAngle: 360 }, // bottom-right
  ]
  return [
    ...lines.map(l => dxfLine(l, layer, color)),
    ...arcs.map(a => dxfArc(a, layer, color)),
  ]
}

export interface BrocheExportData {
  // geometry
  hasDivider: boolean
  dividerX: number
  // text
  showName: boolean
  nameText: string
  nameX: number      // SVG x (text-anchor middle)
  nameY: number      // SVG y
  nameSize: number
  showProfession: boolean
  professionText: string
  professionX: number
  professionY: number
  professionSize: number
}

export function generateBrocheDXF(data: BrocheExportData): string {
  const cutLayer = 'CORTE'
  const engraveLayer = 'GRAVACAO'

  const partLines: string[] = []

  // ── Outer border (CUT, black)
  partLines.push(...roundedRectEntities(0.7, 0.7, 58.6, 23.6, 4, cutLayer, COLOR_BLACK))

  // ── Inner border (ENGRAVE, red)
  partLines.push(...roundedRectEntities(3.1, 3, 53.8, 19, 2.1, engraveLayer, COLOR_RED))

  // ── Divider line
  if (data.hasDivider) {
    partLines.push(dxfLine(
      { x1: data.dividerX, y1: flipY(5.2), x2: data.dividerX, y2: flipY(20.8) },
      engraveLayer, COLOR_RED,
    ))
  }

  // ── Name text
  if (data.showName && data.nameText) {
    partLines.push(dxfText(
      { x: data.nameX, y: flipY(data.nameY), text: data.nameText, height: data.nameSize * 0.9 },
      engraveLayer, COLOR_RED,
    ))
  }

  // ── Profession text
  if (data.showProfession && data.professionText) {
    partLines.push(dxfText(
      { x: data.professionX, y: flipY(data.professionY), text: data.professionText, height: data.professionSize * 0.9 },
      engraveLayer, COLOR_RED,
    ))
  }

  const header = [
    '999', 'Gerado por Capi Studio - www.capilaser.com.br',
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$ACADVER',
    '1', 'AC1009',
    '9', '$INSUNITS',
    '70', '4',  // 4 = millimeters
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'TABLES',
    // LTYPE table (linetype CONTINUOUS)
    '0', 'TABLE',
    '2', 'LTYPE',
    '70', '1',
    '0', 'LTYPE',
    '2', 'CONTINUOUS',
    '70', '0',
    '3', 'Solid line',
    '72', '65',
    '73', '0',
    '40', '0.0',
    '0', 'ENDTAB',
    // LAYER table
    '0', 'TABLE',
    '2', 'LAYER',
    '70', '2',
    '0', 'LAYER',
    '2', cutLayer,
    '70', '0',
    '62', String(COLOR_BLACK),
    '6', 'CONTINUOUS',
    '0', 'LAYER',
    '2', engraveLayer,
    '70', '0',
    '62', String(COLOR_RED),
    '6', 'CONTINUOUS',
    '0', 'ENDTAB',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'ENTITIES',
  ].join('\n')

  const footer = ['0', 'ENDSEC', '0', 'EOF'].join('\n')

  return header + '\n' + partLines.join('\n') + '\n' + footer + '\n'
}

export function downloadText(filename: string, content: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 300)
}
