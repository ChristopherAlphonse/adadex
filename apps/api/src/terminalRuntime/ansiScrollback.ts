const ANSI_BEL = String.fromCharCode(0x07);
const ANSI_ESCAPE = String.fromCharCode(0x1b);
const BROKEN_OSC_TAIL_RE = new RegExp(
  `^\\][^${ANSI_BEL}${ANSI_ESCAPE}]*(?:${ANSI_BEL}|${ANSI_ESCAPE}\\\\)`,
);
const CSI_TAIL_RE = /^\[[0-9:;<=>?]*[ -/]*[@-~]/;
const ORPHANED_CSI_TAIL_RE = /^(?=[0-9:;<=>?]*[;:<=>?])[0-9:;<=>?]*[ -/]*[@-~]/;

/**
 * Scrollback trims old chunks by byte length, which can cut a multi-byte ANSI
 * escape sequence in half (e.g. the ESC byte dropped, leaving a bare OSC/CSI
 * tail). Replaying that fragment verbatim would print garbage before the
 * first real character, so strip any such leading fragment before sending
 * history to a client.
 */
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
