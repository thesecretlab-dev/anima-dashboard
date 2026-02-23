import fs from "node:fs/promises";
import path from "node:path";

export type QueuedFileWriter = {
  filePath: string;
  write: (line: string) => void;
};

export type QueuedFileWriterOptions = {
  dirMode?: number;
  fileMode?: number;
};

export function getQueuedFileWriter(
  writers: Map<string, QueuedFileWriter>,
  filePath: string,
  options: QueuedFileWriterOptions = {},
): QueuedFileWriter {
  const existing = writers.get(filePath);
  if (existing) {
    return existing;
  }

  const dir = path.dirname(filePath);
  const ready = fs
    .mkdir(
      dir,
      options.dirMode !== undefined
        ? { recursive: true, mode: options.dirMode }
        : { recursive: true },
    )
    .catch(() => undefined);
  let queue = Promise.resolve();

  const writer: QueuedFileWriter = {
    filePath,
    write: (line: string) => {
      queue = queue
        .then(() => ready)
        .then(() =>
          options.fileMode !== undefined
            ? fs.appendFile(filePath, line, { encoding: "utf8", mode: options.fileMode })
            : fs.appendFile(filePath, line, "utf8"),
        )
        .catch(() => undefined);
    },
  };

  writers.set(filePath, writer);
  return writer;
}
