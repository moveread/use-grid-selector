import React, { SVGProps } from "react"
import { Vec2 } from "./vectors.js"
import { Template } from "../types.js"
import { renderToStaticMarkup } from "react-dom/server"

type Props = SVGProps<SVGSVGElement> & {
  rows: number[]
  cols: number[]
  size: Vec2
  lineProps?: SVGProps<SVGLineElement>
}

export function SvgGrid({ rows, cols, size, lineProps, ...svgProps }: Props) {
  const defaultedProps: SVGProps<SVGLineElement> = { stroke: 'red', strokeWidth: 2, ...lineProps }
  const lines: JSX.Element[] = []
  for (const [i, r] of rows.entries())
    for (const [j, c] of cols.entries()) {
      const x = Math.round(size[0] * c);
      const y = Math.round(size[1] * r);
      lines.push(
        <line key={`${i}-${j}-v`} x1={x} y1={0} x2={x} y2={size[1]} {...defaultedProps} />, /* vertical */
        <line key={`${i}-${j}-h`} x1={0} y1={y} x2={size[0]} y2={y} {...defaultedProps} /> /* horizontal */
      );
    }
  
  return <svg xmlns="http://www.w3.org/2000/svg" version="1.1" shapeRendering="crispEdges" width={size[0]} height={size[1]} {...svgProps}>{lines}</svg>
}

export function gridSVG(template: Template, size: Vec2, config?: SVGProps<SVGLineElement>): string {
  const elem = <SvgGrid {...template} size={size} lineProps={config} />
  return renderToStaticMarkup(elem)
}

export function gridUrl(template: Template, size: Vec2, config?: SVGProps<SVGLineElement>): string {
  const svg = gridSVG(template, size, config)
  return `data:image/svg+xml;base64,${btoa(svg)}`
}