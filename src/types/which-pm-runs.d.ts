declare module "which-pm-runs" {
  interface PMInfo {
    name: string;
    version?: string;
  }
  function whichPMRuns(): PMInfo | undefined;
  export { whichPMRuns };
}
