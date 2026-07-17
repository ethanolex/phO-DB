// latexTableParser.js

/**
 * Pure table structure parser - NO MATH CONVERSION
 * Just extracts rows and cells from tabular environments
 */

class LaTeXTableParser {
  /**
   * Parse a tabular environment from text
   * Returns structured data or null if parsing fails
   */
  parseTabular(text) {
    try {
      // Extract the tabular content
      const result = this.extractTabularContent(text);
      if (!result) return null;
      
      const { colSpec, content } = result;
      
      // Clean the content - remove \hline but keep everything else
      let cleanedContent = content.replace(/\\hline/g, '');
      
      // Process nested tabulars and arrays (just flatten them)
      cleanedContent = this.processNestedContent(cleanedContent);
      
      // Split into rows
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
   * Extract tabular content using stack-based approach
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
   * Process nested tabulars and arrays - just flatten to text
   */
  processNestedContent(content) {
    let processed = content;
    
    // Process nested tabulars - convert to simple text with <br>
    processed = processed.replace(/\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g, (match, inner) => {
      let clean = inner.replace(/\\hline/g, '');
      clean = clean.replace(/\\\\/g, '<br>');
      clean = clean.replace(/&/g, '');
      return clean.trim();
    });
    
    // Process nested arrays
    processed = processed.replace(/\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}/g, (match, inner) => {
      let clean = inner.replace(/\\\\/g, '<br>');
      clean = clean.replace(/&/g, '');
      return clean.trim();
    });
    
    return processed;
  }

  /**
   * Split content into rows
   */
  splitIntoRows(content) {
    const rows = [];
    let currentRow = '';
    let braceDepth = 0;
    let inMath = false;
    let i = 0;
    
    while (i < content.length) {
      const char = content[i];
      
      // Check for math mode (math is already converted to $...$)
      if (char === '$') {
        inMath = !inMath;
        currentRow += char;
        i++;
        continue;
      }
      
      // Track braces
      if (!inMath) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
      }
      
      // Check for row separator
      if (char === '\\' && i + 1 < content.length && content[i + 1] === '\\' && braceDepth === 0 && !inMath) {
        if (currentRow.trim()) {
          rows.push(currentRow.trim());
        }
        currentRow = '';
        i += 2;
        while (i < content.length && /\s/.test(content[i])) i++;
        if (i < content.length && content[i] === '[') {
          while (i < content.length && content[i] !== ']') i++;
          i++;
        }
        continue;
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
   * Parse a row into cells
   */
  parseRow(row) {
    const cells = [];
    let currentCell = '';
    let braceDepth = 0;
    let inMath = false;
    let i = 0;
    
    while (i < row.length) {
      const char = row[i];
      
      // Track math mode (math is already $...$)
      if (char === '$') {
        inMath = !inMath;
        currentCell += char;
        i++;
        continue;
      }
      
      // Track braces
      if (!inMath) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
      }
      
      // Check for cell separator
      if (char === '&' && braceDepth === 0 && !inMath) {
        if (currentCell.trim()) {
          cells.push(this.parseCell(currentCell.trim()));
        } else {
          cells.push({ content: '', rowspan: 1, colspan: 1 });
        }
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
   * Parse a single cell to extract multirow/multicolumn
   */
  parseCell(cellContent) {
    // Check for \multirow
    const multirowMatch = cellContent.match(/^\\multirow\{([^}]*)\}\{([^}]*)\}\{(.*)\}$/s);
    if (multirowMatch) {
      return {
        content: multirowMatch[3].trim(),
        rowspan: parseInt(multirowMatch[1]) || 1,
        colspan: parseInt(multirowMatch[2]) || 1,
        isMultirow: true
      };
    }
    
    // Check for \multicolumn
    const multicolumnMatch = cellContent.match(/^\\multicolumn\{([^}]*)\}\{([^}]*)\}\{(.*)\}$/s);
    if (multicolumnMatch) {
      return {
        content: multicolumnMatch[3].trim(),
        rowspan: 1,
        colspan: parseInt(multicolumnMatch[1]) || 1,
        isMulticolumn: true
      };
    }
    
    // Regular cell - content already has math converted to $...$
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