import { loadState } from "./planning";
import { repoRoot } from "./shared";
import {
	listStateSnapshots,
	recommendStateRecovery,
	recoverStateSnapshot,
} from "./state-recovery";

if (import.meta.main) {
	const root = repoRoot();
	const args = process.argv.slice(2);

	if (args.includes("--list")) {
		const snapshots = listStateSnapshots(root);
		const recovery = recommendStateRecovery(loadState(root), snapshots);
		if (snapshots.length === 0) {
			console.log("No state snapshots available.");
			process.exit(0);
		}
		console.log("State Snapshots");
		for (const snapshot of snapshots) {
			const marker =
				recovery.recommendedStateSnapshot?.fileName === snapshot.fileName
					? " | RECOMMENDED"
					: "";
			console.log(
				`  ${snapshot.fileName} | ${snapshot.createdAt} | ${snapshot.sizeBytes} bytes | trigger=${snapshot.trigger}${marker}`,
			);
		}
		if (recovery.recommendedRecoveryPoint.path) {
			console.log(
				`Recommended recovery point: ${recovery.recommendedRecoveryPoint.kind} -> ${recovery.recommendedRecoveryPoint.path}`,
			);
			console.log(`Reason: ${recovery.recommendedRecoveryPoint.reason}`);
		}
		if (
			recovery.recommendedStateSnapshot &&
			recovery.recommendedStateSnapshotReason
		) {
			console.log(
				`Recommended snapshot reason: ${recovery.recommendedStateSnapshotReason}`,
			);
		}
		process.exit(0);
	}

	const latest = args.includes("--latest");
	const recommended = args.includes("--recommended");
	const fileArgIndex = args.indexOf("--file");
	const fileName =
		fileArgIndex >= 0 && args.length > fileArgIndex + 1
			? args[fileArgIndex + 1]
			: undefined;

	if (!latest && !recommended && !fileName) {
		console.error(
			"Usage: bun run harness:state-recover --list | --latest | --recommended | --file <snapshot-file>",
		);
		process.exit(1);
	}

	const snapshots = listStateSnapshots(root);
	const recovery = recommendStateRecovery(loadState(root), snapshots);
	const restored = recoverStateSnapshot(root, {
		latest,
		fileName:
			fileName ??
			(recommended ? recovery.recommendedStateSnapshot?.fileName : undefined),
	});
	if (!restored) {
		console.error("No matching state snapshot found.");
		process.exit(1);
	}

	console.log(
		`Recovered .harness/state.json from ${restored.fileName} (${restored.createdAt}).`,
	);
	if (
		recommended &&
		recovery.recommendedStateSnapshotReason &&
		restored.fileName === recovery.recommendedStateSnapshot?.fileName
	) {
		console.log(`Reason: ${recovery.recommendedStateSnapshotReason}`);
	}
}
