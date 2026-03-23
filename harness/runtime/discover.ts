import { stdin } from "node:process";
import { loadState } from "./planning";
import { applyDiscoveryAnswers, nextPacketJson, resetDiscovery } from "./discovery";
import type { DiscoveryAnswerBatch } from "./types";
import { repoRoot } from "./shared";

const root = repoRoot();
const args = process.argv.slice(2);

if (args.includes("--reset")) {
  const state = resetDiscovery(root);
  console.log(`Discovery reset. Stage: ${state.discovery.stage}`);
  process.exit(0);
}

if (args.includes("--answer-from-stdin")) {
  const chunks: string[] = [];
  for await (const chunk of stdin) {
    chunks.push(chunk.toString());
  }
  const payload = JSON.parse(chunks.join("")) as DiscoveryAnswerBatch;
  const state = applyDiscoveryAnswers(root, payload);
  console.log(JSON.stringify({
    stage: state.discovery.stage,
    readiness: state.discovery.readiness,
    currentQuestionIds: state.discovery.currentQuestionIds
  }, null, 2));
  process.exit(0);
}

if (args.includes("--next") && args.includes("--json")) {
  const packet = nextPacketJson(root);
  console.log(JSON.stringify(packet, null, 2));
  process.exit(0);
}

const packet = nextPacketJson(root);
const state = loadState(root);
console.log("Discovery Status");
console.log(`  Stage: ${state.discovery.stage}`);
console.log(`  Status: ${state.discovery.status}`);
console.log(`  Product ready: ${state.discovery.readiness.productReady}`);
console.log(`  Architecture ready: ${state.discovery.readiness.architectureReady}`);
console.log(`  Plan ready: ${state.discovery.readiness.planReady}`);
console.log(`  Next questions: ${packet ? packet.questionIds.join(", ") : "none"}`);
