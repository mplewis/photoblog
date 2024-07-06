import dayjs from "dayjs";
import texLinebreak from "tex-linebreak";
import type { OriginalMetadata } from "../types";

const { breakLines } = texLinebreak;
type TextInputItem = texLinebreak.TextInputItem;

const CAPTION_MAX_LEN = 20;
const IGNORE_F_AT = 1.0; // Fujifilm reports f/1.0 for non-electronic lenses
const PROFILE_RE = /^Camera (.+)$/; // Match Fujifilm "Camera CLASSIC CHROME" and ignore others

interface Metadata
  extends Pick<
    OriginalMetadata,
    | "cameraMake"
    | "cameraModel"
    | "cameraProfile"
    | "date"
    | "description"
    | "exposureTime"
    | "fNumber"
    | "focalLength"
    | "iso"
    | "lensMake"
    | "lensModel"
    | "localDate"
    | "location"
    | "title"
  > {}

/** Replace all instances of 2+ spaces with 1 space. */
function trimSp(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** For two strings of space-delineated words, return `toTrim` without any shared prefix words from `base`. */
function trimCommonPrefixWords(base: string, toTrim: string): string {
  const baseWords = base.split(" ");
  const toTrimWords = toTrim.split(" ");
  for (let i = 0; i < baseWords.length && i < toTrimWords.length; i++) {
    if (baseWords[i] !== toTrimWords[i]) return toTrimWords.slice(i).join(" ");
  }
  return toTrimWords.slice(baseWords.length).join(" ");
}

/** Summarize a lens and focal length, omitting the focal length if it is equal to the prime lens length. */
export function summarizeLensFocalLength(
  lens: string,
  focalLength: number
): string[] {
  const combined = [lens, `${Math.round(focalLength)}mm`];

  // If the lens spec has a range, e.g. 16-80mm, always show focal length
  if (lens.match(/\d+-\d+mm/)) return combined;

  // Parse the prime focal length from the lens name
  const lensFLMatch = lens.match(/(\d+(.\d+)?)mm/);
  if (!lensFLMatch || !lensFLMatch[1]) return combined;
  const parsedFocalLength = parseFloat(lensFLMatch[1]);

  // If the lens spec matches the actual focal length, omit it
  const match = Math.abs(parsedFocalLength - focalLength) < 1.0;
  return match ? [lens] : combined;
}

/** True if the lens spec contains the given focal length, false otherwise. */
export function lensSpecMatchesFNum(lens: string, fNum: number): boolean {
  const lensFNumMatches = lens.match(/[Ff𝑓]\/?(\d+(.\d+)?)/g);
  if (!lensFNumMatches) return false;
  const lastMatch = lensFNumMatches[lensFNumMatches.length - 1];
  if (!lastMatch) return false;
  const fnMatch = lastMatch.match(/\d+(.\d+)?/);
  if (!fnMatch) return false;
  const lensFNum = parseFloat(fnMatch[0]);

  return Math.abs(lensFNum - fNum) < 0.1;
}

/** Convert a set of indivisible chunks into a series of lines fitting within `maxLen` cols, joined by `sep`. */
export function chunksToLines(
  maxLen: number,
  chunks: string[],
  sep = ", "
): string[] {
  const glue = {
    type: "glue",
    text: sep,
    width: sep.length,
    stretch: 0,
    shrink: 0,
  } as const;
  const items: TextInputItem[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    items.push({ type: "box", width: chunk.length, text: chunk });
    if (i < chunks.length - 1) items.push(glue);
  }

  const breakpoints = breakLines(items, maxLen);

  const lines: string[][] = [];
  let lineIdx = -1;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (breakpoints.includes(i)) {
      lineIdx++;
      lines[lineIdx] = [];
    }
    if (item.type !== "box") continue;
    lines[lineIdx]!.push(item.text);
  }
  return lines.map((line) => line.join(", "));
}

/** Parse a `Camera SOME PROFILE => SOME PROFILE` value from Fujifilm `CameraProfile` metadata. */
function parseCameraProfile(profile?: string): string | null {
  if (!profile) return null;
  const match = profile.match(PROFILE_RE);
  return (match && match[1]) ?? null;
}

/** Summarize a set of camera metadata into a photo title and description. */
export function describeMetadata(m: Metadata): {
  title?: string | undefined;
  description: string;
} {
  if (!m.date) throw new Error(`Missing date for ${JSON.stringify(m)}`);

  const camera = trimSp(`${m.cameraMake || ""} ${m.cameraModel || ""}`);
  let lens = trimSp(`${m.lensMake || ""} ${m.lensModel || ""}`);
  lens = trimCommonPrefixWords(camera, lens);
  // TODO: Prettify all lens names by using regex replace for [Ff𝑓]/?\d+(.\d+)?
  lens = lens.replaceAll("f/", "𝑓").replaceAll("F/", "𝑓");

  // Summarize lens and focal length
  let lensAndFL = [lens];
  if (lens && m.focalLength)
    lensAndFL = summarizeLensFocalLength(lens, m.focalLength);

  // Summarize core settings
  const s: string[] = [];
  if (m.exposureTime) s.push(`${m.exposureTime}s`);
  if (m.fNumber) {
    const fNum = parseFloat(m.fNumber);
    if (fNum != IGNORE_F_AT) {
      const match = lensSpecMatchesFNum(lens, fNum);
      if (!match) s.push(`𝑓${m.fNumber}`);
    }
  }
  if (m.iso) s.push(`ISO ${m.iso}`);
  const settings = s.join(", ");
  const profile = parseCameraProfile(m.cameraProfile);

  // Format local date
  let localDate: string | undefined;
  if (m.localDate) {
    const [y, mo, d, h, mi, s] = m.localDate;
    const parsed = dayjs(`${y}-${mo}-${d} ${h}:${mi}:${s}`);
    localDate = parsed.format("ddd MMM D HH:mm");
  }

  // Combine details into desc chunks, then layout into lines
  const d: (string | null | undefined)[] = [
    localDate,
    m.location,
    camera,
    ...lensAndFL,
    settings,
    profile && `Profile: ${profile}`,
  ];
  const dx = d.filter(Boolean) as string[];
  const details = chunksToLines(CAPTION_MAX_LEN, dx).join("\n");

  // Build final description
  const description = [details, m.description]
    .filter(Boolean)
    .join("\n")
    .trim();

  return { title: m.title, description };
}
