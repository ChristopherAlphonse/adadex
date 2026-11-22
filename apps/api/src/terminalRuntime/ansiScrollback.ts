const ANSI_BEL = String.fromCharCode(0x07);

const ANSI_ESCAPE = String.fromCharCode(0x1b);

const BROKEN_OSC_TAIL_RE = new RegExp(
  `^\\][^${ANSI_BEL}${ANSI_ESCAPE}]*(?:${ANSI_BEL}|${ANSI_ESCAPE}\\\\)`,
);

const CSI_TAIL_RE = /^\[[0-9:;<=>?]*[ -/]*[@-~]/;

const ORPHANED_CSI_TAIL_RE = /^(?=[0-9:;<=>?]*[;:<=>?])[0-9:;<=>?]*[ -/]*[@-~]/;

export const stripBrokenLeadingAnsi = (text: string): string => {
  let nextText = text;

  while (nextText.length > 0) {
    if (nextText.startsWith("\u001b")) {
      return nextText;
    }

    const oscMatch = nextText.match(BROKEN_OSC_TAIL_RE);

    if (oscMatch) {
      nextText = nextText.slice(oscMatch[0].length);
      continue;
    }

    const csiTailMatch = nextText.match(CSI_TAIL_RE);

    if (csiTailMatch) {
      nextText = nextText.slice(csiTailMatch[0].length);
      continue;
    }

    const orphanedCsiTailMatch = nextText.match(ORPHANED_CSI_TAIL_RE);

    if (orphanedCsiTailMatch) {
      nextText = nextText.slice(orphanedCsiTailMatch[0].length);
      continue;
    }

    break;
  }

  return nextText;
};
