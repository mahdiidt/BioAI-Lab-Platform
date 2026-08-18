// Newick Format Tree Parser
export interface PhyloNode {
  name: string;
  branchLength?: number;
  children: PhyloNode[];
  isLeaf: boolean;
}

export interface NewickParseResult {
  root: PhyloNode | null;
  isValid: boolean;
  errorMessage?: string;
  warning?: string;
  totalLeaves: number;
}

/**
 * Strict numeric-token validator for Newick branch lengths.
 *
 * parseFloat() is intentionally NOT used for validation: it accepts any
 * valid numeric *prefix* of a string and silently ignores trailing
 * garbage (e.g. parseFloat('0.1abc') === 0.1, parseFloat('12.3.4') ===
 * 12.3), which would let malformed branch lengths through as valid.
 *
 * This regex requires the ENTIRE trimmed token to be a single valid
 * decimal or scientific-notation number, matching standard Newick
 * branch length forms: 0, 0.1, 1, 12.3, 1e-3, 1E-3, -0.5, +2.
 */
const BRANCH_LENGTH_TOKEN = /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/;

function parseBranchLength(token: string): number {
  const trimmed = token.trim();
  if (!BRANCH_LENGTH_TOKEN.test(trimmed)) {
    throw new Error(`Invalid branch length '${token}': must be a complete numeric value (e.g. 0.1, 12.3, 1e-3).`);
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid branch length '${token}': not a finite number.`);
  }
  return parsed;
}

/**
 * Parses a Newick format string into a nested tree structure.
 * Example: "(A:0.1,B:0.2,(C:0.3,D:0.4)E:0.5);"
 */
export function parseNewick(newickString: string): NewickParseResult {
  if (!newickString || !newickString.trim()) {
    return {
      root: null,
      isValid: false,
      errorMessage: 'Newick string is empty.',
      totalLeaves: 0,
    };
  }

  let warning: string | undefined = undefined;
  if (/['"\[\]]/.test(newickString)) {
    warning = 'Advanced Newick features (quoted labels or NHX comments) are not fully supported.';
  }

  let str = newickString.trim();
  const semicolonIndex = str.indexOf(';');

  // A Newick terminator is optional here, but if one is present it must be
  // the final non-whitespace character. This prevents inputs such as
  // `(A:0.1,B:0.2);GARBAGE` from being accepted as a valid tree label.
  if (semicolonIndex !== -1) {
    if (semicolonIndex !== str.length - 1 || str.lastIndexOf(';') !== semicolonIndex) {
      return {
        root: null,
        isValid: false,
        errorMessage: 'Invalid Newick syntax: unexpected content after the tree terminator.',
        totalLeaves: 0,
      };
    }
    str = str.slice(0, -1).trim();
  }

  if (!str.startsWith('(')) {
    return {
      root: null,
      isValid: false,
      errorMessage: 'Invalid Newick syntax: Must start with "(" or contain nested parenthesized clades.',
      totalLeaves: 0,
    };
  }

  let pDepth = 0;
  for (const char of str) {
    if (char === '(') pDepth++;
    else if (char === ')') {
      pDepth--;
      if (pDepth < 0) {
        return {
          root: null,
          isValid: false,
          errorMessage: 'Unbalanced parentheses in Newick string.',
          totalLeaves: 0,
        };
      }
    }
  }
  if (pDepth !== 0) {
    return {
      root: null,
      isValid: false,
      errorMessage: 'Unbalanced parentheses in Newick string.',
      totalLeaves: 0,
    };
  }

  let leafCount = 0;

  function parseSubtree(s: string): PhyloNode {
    s = s.trim();

    // Check if node has children: starts with '('
    if (s.startsWith('(')) {
      // Find matching closing parenthesis for top-level clade
      let depth = 0;
      let splitIdx = -1;

      for (let i = 0; i < s.length; i++) {
        if (s[i] === '(') depth++;
        else if (s[i] === ')') {
          depth--;
          if (depth === 0) {
            splitIdx = i;
            break;
          }
        }
      }

      if (splitIdx === -1) {
        throw new Error('Unbalanced parentheses in Newick string.');
      }

      const childrenStr = s.substring(1, splitIdx);
      const rest = s.substring(splitIdx + 1).trim();

      // Split children by comma at depth 0
      const childSubstrings: string[] = [];
      let cDepth = 0;
      let start = 0;

      for (let i = 0; i < childrenStr.length; i++) {
        if (childrenStr[i] === '(') cDepth++;
        else if (childrenStr[i] === ')') cDepth--;
        else if (childrenStr[i] === ',' && cDepth === 0) {
          childSubstrings.push(childrenStr.substring(start, i));
          start = i + 1;
        }
      }
      childSubstrings.push(childrenStr.substring(start));

      const children = childSubstrings.map((cs) => {
        if (!cs.trim()) {
          throw new Error('Invalid Newick syntax: Empty clade comma split encountered.');
        }
        return parseSubtree(cs);
      });

      // Parse node label and branch length from `rest` (e.g. "NodeE:0.5" or ":0.5")
      let name = '';
      let branchLength: number | undefined = undefined;

      if (rest) {
        if (rest.includes(':')) {
          const parts = rest.split(':');
          if (parts.length > 2) {
            throw new Error(`Invalid branch length expression '${rest}': multiple colons found.`);
          }
          name = parts[0].trim();
          branchLength = parseBranchLength(parts[1]);
        } else {
          name = rest;
        }
      }

      return {
        name,
        branchLength,
        children,
        isLeaf: false,
      };
    } else {
      // Leaf node: "LeafA:0.1" or "LeafA"
      if (!s.trim()) {
        throw new Error('Invalid Newick syntax: Empty clade node.');
      }
      leafCount++;
      let name = s.trim();
      let branchLength: number | undefined = undefined;

      if (s.includes(':')) {
        const parts = s.split(':');
        if (parts.length > 2) {
          throw new Error(`Invalid branch length expression '${s}': multiple colons found.`);
        }
        name = parts[0].trim();
        branchLength = parseBranchLength(parts[1]);
      }

      return {
        name: name || `Taxon_${leafCount}`,
        branchLength,
        children: [],
        isLeaf: true,
      };
    }
  }

  try {
    const root = parseSubtree(str);
    return {
      root,
      isValid: true,
      warning,
      totalLeaves: leafCount,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to parse Newick tree syntax.';
    return {
      root: null,
      isValid: false,
      errorMessage: errorMsg,
      totalLeaves: 0,
    };
  }
}
