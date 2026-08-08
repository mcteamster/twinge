// Ambient declarations for packages without bundled type definitions

declare module '@microsoft/clarity' {
  const Clarity: {
    init: (projectId: string) => void;
  };
  export default Clarity;
}
