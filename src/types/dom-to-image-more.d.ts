declare module 'dom-to-image-more' {
  interface Options {
    quality?: number;
    bgcolor?: string;
    width?: number;
    height?: number;
    style?: Partial<CSSStyleDeclaration>;
    filter?: (node: Node) => boolean;
    imagePlaceholder?: string;
    cacheBust?: boolean;
  }

  function toPng(node: Node, options?: Options): Promise<string>;
  function toJpeg(node: Node, options?: Options): Promise<string>;
  function toSvg(node: Node, options?: Options): Promise<string>;
  function toBlob(node: Node, options?: Options): Promise<Blob>;
  function toCanvas(node: Node, options?: Options): Promise<HTMLCanvasElement>;

  export default { toPng, toJpeg, toSvg, toBlob, toCanvas };
  export { toPng, toJpeg, toSvg, toBlob, toCanvas };
}
