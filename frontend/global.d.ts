// Guide TypeScript to handle CSS imports
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}