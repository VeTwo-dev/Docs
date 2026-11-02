declare module "which-pm-runs" {
  /** Returns the package manager that invoked the current process, if detected. */
  export function whichPMRuns(): { name: string; version: string } | undefined;
}
