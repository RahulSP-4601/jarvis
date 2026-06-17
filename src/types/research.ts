export type ResearchResponse = {
  action: "respond" | "hide_overlay";
  transcript: string;
  title: string;
  summary: string;
  keyFindings: string[];
  recommendation: string;
  images: string[];
};
