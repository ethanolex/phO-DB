class LaTeXTableParser {
  /**
   * Parse a tabular environment from text
   * Returns structured data or null if parsing fails
   */
  parseTabular(text) {
    try {
      const result = this.extractTabularContent(text);
      if (!result) return null;

      const { colSpec, content } = result;

      // Process nested tabulars and arrays first (flatten them)
      let cleanedContent = this.processNestedContent(content);

      // Remove \hline but preserve structure
      cleanedContent = cleanedContent.replace(/\\hline\s*/g, '');

      // Split into rows with proper handling of math mode and braces
      const rows = this.splitIntoRows(cleanedContent);

      // Parse each row into cells
      const parsedRows = rows.map(row => this.parseRow(row));

      // Filter out empty rows
      const filteredRows = parsedRows.filter(row => row.length > 0);

      if (filteredRows.length === 0) return null;

      return {
        colSpec: colSpec,
        rows: filteredRows,
        isSingleColumn: this.isSingleColumn(filteredRows, colSpec)
      };
    } catch (error) {
      console.warn('Error parsing tabular:', error);
      return null;
    }
  }

  /**
   * Extract tabular content using stack-based approach with proper nesting
   */
  extractTabularContent(text) {
    const beginMatch = text.match(/\\begin\{tabular\}\{([^}]*)\}/);
    if (!beginMatch) return null;

    const colSpec = beginMatch[1];
    const startPos = beginMatch.index + beginMatch[0].length;

    let depth = 1;
    let pos = startPos;
    const beginMarker = '\\begin{tabular}';
    const endMarker = '\\end{tabular}';

    while (pos < text.length && depth > 0) {
      const nextBegin = text.indexOf(beginMarker, pos);
      const nextEnd = text.indexOf(endMarker, pos);

      if (nextEnd === -1) return null;

      if (nextBegin !== -1 && nextBegin < nextEnd) {
        depth++;
        pos = nextBegin + beginMarker.length;
      } else {
        depth--;
        if (depth === 0) {
          const content = text.slice(startPos, nextEnd);
          return { colSpec, content };
        }
        pos = nextEnd + endMarker.length;
      }
    }

    return null;
  }

  /**
   * Process nested tabulars and arrays - flatten to text with <br> separators
   */
  processNestedContent(content) {
    let processed = content;

    // Process nested tabulars - convert to simple text with <br>
    processed = processed.replace(
      /\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g,
      (match, inner) => {
        let clean = inner.replace(/\\hline/g, '');
        clean = clean.replace(/\\\\/g, '<br>');
        clean = clean.replace(/&/g, '');
        return clean.trim();
      }
    );

    // Process nested arrays
    processed = processed.replace(
      /\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}/g,
      (match, inner) => {
        let clean = inner.replace(/\\\\/g, '<br>');
        clean = clean.replace(/&/g, '');
        return clean.trim();
      }
    );

    return processed;
  }

  /**
   * Split content into rows with proper handling of math mode, braces, and escaped characters
   */
  splitIntoRows(content) {
    const rows = [];
    let currentRow = '';
    let braceDepth = 0;
    let inMath = false;
    let inEscaped = false;
    let i = 0;

    while (i < content.length) {
      const char = content[i];
      const nextChar = i + 1 < content.length ? content[i + 1] : '';

      // Handle escape sequences
      if (char === '\\' && !inEscaped) {
        // Check for \\ (row separator) vs \command
        if (nextChar === '\\') {
          // This is a row separator \\\\
          if (braceDepth === 0 && !inMath) {
            if (currentRow.trim()) {
              rows.push(currentRow.trim());
            }
            currentRow = '';
            i += 2;
            // Skip optional spacing argument [dimen]
            while (i < content.length && /\s/.test(content[i])) i++;
            if (i < content.length && content[i] === '[') {
              while (i < content.length && content[i] !== ']') i++;
              i++; // skip ]
            }
            continue;
          } else {
            // Escaped backslash inside braces/math - treat as literal
            currentRow += char + nextChar;
            i += 2;
            continue;
          }
        } else if (/[a-zA-Z]/.test(nextChar)) {
          inEscaped = true;
          currentRow += char;
          i++;
          continue;
        } else {
          currentRow += char + nextChar;
          i += 2;
          continue;
        }
      }

      if (inEscaped) {
        // We're in an escape sequence - just accumulate until we hit a non-letter
        if (/[a-zA-Z]/.test(char)) {
          currentRow += char;
          i++;
          continue;
        } else if (char === ' ' || char === '\n') {
          inEscaped = false;
          currentRow += char;
          i++;
          continue;
        } else {
          inEscaped = false;
          continue;
        }
      }

      // Check for math mode
      if (char === '$') {
        // Check if it's $$ (display math)
        if (nextChar === '$') {
          inMath = !inMath;
          currentRow += '$$';
          i += 2;
        } else {
          inMath = !inMath;
          currentRow += '$';
          i++;
        }
        continue;
      }

      // Track braces (but not inside math mode)
      if (!inMath) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
      }

      currentRow += char;
      i++;
    }

    if (currentRow.trim()) {
      rows.push(currentRow.trim());
    }

    return rows;
  }

  /**
   * Parse a row into cells with proper handling of math mode and braces
   */
  parseRow(row) {
    const cells = [];
    let currentCell = '';
    let braceDepth = 0;
    let inMath = false;
    let inEscaped = false;
    let i = 0;

    while (i < row.length) {
      const char = row[i];
      const nextChar = i + 1 < row.length ? row[i + 1] : '';

      // Handle escape sequences
      if (char === '\\' && !inEscaped) {
        if (nextChar === '\\') {
          // Escaped backslash - add to cell content
          currentCell += '\\\\';
          i += 2;
          continue;
        } else if (/[a-zA-Z]/.test(nextChar)) {
          inEscaped = true;
          currentCell += char;
          i++;
          continue;
        } else {
          currentCell += char + nextChar;
          i += 2;
          continue;
        }
      }

      if (inEscaped) {
        if (/[a-zA-Z]/.test(char)) {
          currentCell += char;
          i++;
          continue;
        } else {
          inEscaped = false;
          continue;
        }
      }

      // Track math mode
      if (char === '$') {
        if (nextChar === '$') {
          inMath = !inMath;
          currentCell += '$$';
          i += 2;
        } else {
          inMath = !inMath;
          currentCell += '$';
          i++;
        }
        continue;
      }

      // Track braces (but not inside math mode)
      if (!inMath) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
      }

      // Check for cell separator
      if (char === '&' && braceDepth === 0 && !inMath) {
        cells.push(this.parseCell(currentCell.trim()));
        currentCell = '';
      } else {
        currentCell += char;
      }
      i++;
    }

    if (currentCell.trim()) {
      cells.push(this.parseCell(currentCell.trim()));
    }

    return cells;
  }

  /**
   * Parse a single cell to extract multirow/multicolumn with robust regex
   * FIXED: Now allows whitespace around commands and braces
   */
  parseCell(cellContent) {
    const trimmed = cellContent.trim();

    // Check for \multirow{rows}{width}{content}
    // Width is often * (natural width)
    // Use flexible regex that allows whitespace
    const multirowMatch = trimmed.match(/^\s*\\multirow\s*\{\s*(\d+)\s*\}\s*\{\s*([^}]*)\s*\}\s*\{([\s\S]*)\}\s*$/);
    if (multirowMatch) {
      return {
        content: multirowMatch[3].trim(),
        rowspan: parseInt(multirowMatch[1]) || 1,
        colspan: 1,
        isMultirow: true
      };
    }

    // Check for \multicolumn{columns}{alignment}{content}
    const multicolumnMatch = trimmed.match(/^\s*\\multicolumn\s*\{\s*(\d+)\s*\}\s*\{\s*([^}]*)\s*\}\s*\{([\s\S]*)\}\s*$/);
    if (multicolumnMatch) {
      return {
        content: multicolumnMatch[3].trim(),
        rowspan: 1,
        colspan: parseInt(multicolumnMatch[1]) || 1,
        isMulticolumn: true
      };
    }

    // Check for combined \multicolumn + \multirow
    // Pattern: \multicolumn{N}{align}{\multirow{M}{width}{content}}
    const combinedMatch = trimmed.match(
      /^\s*\\multicolumn\s*\{\s*(\d+)\s*\}\s*\{\s*([^}]*)\s*\}\s*\{\s*\\multirow\s*\{\s*(\d+)\s*\}\s*\{\s*([^}]*)\s*\}\s*\{([\s\S]*)\}\s*\}\s*$/
    );
    if (combinedMatch) {
      return {
        content: combinedMatch[5].trim(),
        rowspan: parseInt(combinedMatch[3]) || 1,
        colspan: parseInt(combinedMatch[1]) || 1,
        isMultirow: true,
        isMulticolumn: true
      };
    }

    // Regular cell
    return {
      content: cellContent,
      rowspan: 1,
      colspan: 1
    };
  }

  /**
   * Check if the table is single column
   */
  isSingleColumn(rows, colSpec) {
    if (rows.length === 0) return true;

    const allSingle = rows.every(row => row.length <= 1);
    if (allSingle) return true;

    const cleanSpec = colSpec ? colSpec.replace(/\|/g, '') : '';
    if (cleanSpec.length <= 1) return true;

    return false;
  }
}

export default LaTeXTableParser;
