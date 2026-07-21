import katex from 'katex';
import LaTeXTableParser from './latexTableParser';
import LaTeXRenderer from './latexRenderer';

const parser = new LaTeXTableParser();
const renderer = new LaTeXRenderer();

// KaTeX render options
const KATEX_OPTIONS = {
  throwOnError: false,
  strict: 'ignore',
  trust: true,
  macros: {}
};

const normalizeLatex = (latex) => {
  return latex
    ?.replace(/\\(?:text|textbf|textit|textrm|mathrm|mathbf|mathit|operatorname)\s*\{\s*\}/g, '')
    .trim();
};

/**
 * Render inline math ($...$) to KaTeX HTML
 */
const renderInlineMath = (latex) => {
  const normalizedLatex = normalizeLatex(latex);
  if (!normalizedLatex) return '';

  try {
    return katex.renderToString(normalizedLatex, { ...KATEX_OPTIONS, displayMode: false });
  } catch (err) {
    console.warn('KaTeX inline render error:', err.message, 'for:', latex);
    return '<span style="color: #cc0000;">$' + latex + '$</span>';
  }
};

/**
 * Render display math ($$...$$) to KaTeX HTML
 */
const renderDisplayMath = (latex) => {
  const normalizedLatex = normalizeLatex(latex);
  if (!normalizedLatex) return '';

  try {
    return katex.renderToString(normalizedLatex, { ...KATEX_OPTIONS, displayMode: true });
  } catch (err) {
    console.warn('KaTeX display render error:', err.message, 'for:', latex);
    return '<div style="color: #cc0000; text-align: center;">$$' + latex + '$$</div>';
  }
};

/**
 * Render math in text - handles both inline and display
 * This is used for table cells, figure captions, etc.
 */
const renderMathInText = (text) => {
  if (!text) return '';
  
  let result = text;
  
  // Render display math first ($$...$$) to avoid conflicts with inline
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    return renderDisplayMath(math.trim());
  });
  
  // Render inline math ($...$)
  result = result.replace(/\$([^\$\n]+?)\$/g, (match, math) => {
    return renderInlineMath(math.trim());
  });
  
  return result;
};

/**
 * Main entry point: preprocess Mathpix Markdown content
 * Returns HTML string with all math pre-rendered
 */
export const preprocessMathpix = (text) => {
  if (!text || typeof text !== 'string') return '';
  let processed = text;

  // STEP 0: Normalize line endings
  processed = processed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // STEP 1: Convert LaTeX math delimiters to standard ones FIRST
  // \( ... \) → $...$
  processed = processed.replace(/\\\((.*?)\\\)/gs, (match, math) => {
    return ' $' + math.trim() + '$ ';
  });

  // \[...\] → $$...$$
  processed = processed.replace(/\\\[(.*?)\\\]/gs, (match, math) => {
    return '\n\n$$\n' + math.trim() + '\n$$\n\n';
  });

  // STEP 2: Process LaTeX environments that need special handling
  // These are processed BEFORE tables because they may contain tabulars
  processed = processEquationEnvironments(processed);
  processed = processAlignEnvironments(processed);
  processed = processGatherEnvironments(processed);
  processed = processMatrixEnvironments(processed);
  processed = processCasesEnvironments(processed);

  // STEP 3: Process Figures (before tables to avoid conflicts)
  processed = processFigures(processed);

  // STEP 4: Process LaTeX tables
  processed = processTables(processed);

  // STEP 5: Process lists
  processed = processLaTeXLists(processed);

  // STEP 6: Process text formatting commands
  processed = processTextFormatting(processed);

  // STEP 7: Process sections
  processed = processSections(processed);

  // STEP 8: Process title/author/abstract
  processed = processDocumentCommands(processed);

  // STEP 9: Process chemistry (SMILES) - basic pass-through
  processed = processChemistry(processed);

  // STEP 10: Fix essential escape characters
  processed = processed
    .replace(/\\%/g, '%')
    .replace(/\\&/g, '&')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_')
    .replace(/\\\$/g, '$')
    .replace(/\\~/g, '~')
    .replace(/\\\^/g, '^');

  processed = renderArrayEnvironments(processed);

  // STEP 12: Render ALL remaining math to KaTeX HTML
  // This handles math outside of tables/figures that wasn't pre-rendered
  processed = renderAllMath(processed);

  // STEP 13: Clean up multiple blank lines
  processed = processed.replace(/\n{4,}/g, '\n\n\n');

  return processed;
};

/**
 * Render all math delimiters in text to KaTeX HTML
 * This is the final pass that catches any math not already rendered
 */
const renderAllMath = (text) => {
  if (!text) return '';
  
  let result = text;
  
  // Display math first (greedy match)
  result = result.replace(/\$\$\n?([\s\S]*?)\n?\$\$/g, (match, math) => {
    return renderDisplayMath(math.trim());
  });
  
  // Inline math
  result = result.replace(/\$([^\$\n]+?)\$/g, (match, math) => {
    return renderInlineMath(math.trim());
  });
  
  return result;
};

// ============================================================================
// EQUATION ENVIRONMENTS
// ============================================================================

const processEquationEnvironments = (text) => {
  text = text.replace(
    /\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g,
    (match, content) => {
      return '\n\n$$\n' + content.trim() + '\n$$\n\n';
    }
  );

  text = text.replace(
    /\\begin\{equation\*\}([\s\S]*?)\\end\{equation\*\}/g,
    (match, content) => {
      return '\n\n$$\n' + content.trim() + '\n$$\n\n';
    }
  );

  return text;
};

const processAlignEnvironments = (text) => {
  text = text.replace(
    /\\begin\{align\}([\s\S]*?)\\end\{align\}/g,
    (match, content) => {
      const converted = content
        .replace(/\\begin\{aligned\}/g, '')
        .replace(/\\end\{aligned\}/g, '');
      return '\n\n$$\n\\begin{aligned}\n' + converted.trim() + '\n\\end{aligned}\n$$\n\n';
    }
  );

  text = text.replace(
    /\\begin\{align\*\}([\s\S]*?)\\end\{align\*\}/g,
    (match, content) => {
      const converted = content
        .replace(/\\begin\{aligned\}/g, '')
        .replace(/\\end\{aligned\}/g, '');
      return '\n\n$$\n\\begin{aligned}\n' + converted.trim() + '\n\\end{aligned}\n$$\n\n';
    }
  );

  text = text.replace(
    /\\begin\{split\}([\s\S]*?)\\end\{split\}/g,
    (match, content) => {
      return '\n\n$$\n\\begin{aligned}\n' + content.trim() + '\n\\end{aligned}\n$$\n\n';
    }
  );

  return text;
};

const processGatherEnvironments = (text) => {
  text = text.replace(
    /\\begin\{gather\}([\s\S]*?)\\end\{gather\}/g,
    (match, content) => {
      const lines = content.trim().split('\\\\');
      const equations = lines
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => '$$\n' + line + '\n$$');
      return '\n\n' + equations.join('\n\n') + '\n\n';
    }
  );

  text = text.replace(
    /\\begin\{gather\*\}([\s\S]*?)\\end\{gather\*\}/g,
    (match, content) => {
      const lines = content.trim().split('\\\\');
      const equations = lines
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => '$$\n' + line + '\n$$');
      return '\n\n' + equations.join('\n\n') + '\n\n';
    }
  );

  return text;
};

const renderArrayEnvironments = (text) => {
  text = text.replace(
    /\$\$\s*(\\begin\{array\}\{[^}]*\}[\s\S]*?\\end\{array\})\s*\$\$/g,
    (match, latex) => renderDisplayMath(latex.trim())
  );

  text = text.replace(
    /\\begin\{array\}\{([^}]*)\}([\s\S]*?)\\end\{array\}/g,
    (match, colSpec, content) => {
      return renderDisplayMath('\\begin{array}{' + colSpec + '}' + content + '\\end{array}');
    }
  );

  return text;
};

const processMatrixEnvironments = (text) => {
  const matrixEnvs = [
    'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix'
  ];

  matrixEnvs.forEach(env => {
    // First: normalize already-wrapped ones
    const wrappedRegex = new RegExp(
      `\\$\\$\\\\begin\\{${env}\\}([\\s\\S]*?)\\\\end\\{${env}\\}\\$\\$`,
      'g'
    );
    text = text.replace(wrappedRegex, (match, content) => {
      return '\n\n$$\n\\begin{' + env + '}\n' + content.trim() + '\n\\end{' + env + '}\n$$\n\n';
    });

    // Second: wrap unwrapped ones
    const unwrappedRegex = new RegExp(
      `\\\\begin\\{${env}\\}([\\s\\S]*?)\\\\end\\{${env}\\}`,
      'g'
    );
    text = text.replace(unwrappedRegex, (match, content) => {
      return '\n\n$$\n\\begin{' + env + '}\n' + content.trim() + '\n\\end{' + env + '}\n$$\n\n';
    });
  });

  return text;
};

const processCasesEnvironments = (text) => {
  // First: normalize already-wrapped cases
  text = text.replace(
    /\$\$\\begin\{cases\}([\s\S]*?)\\end\{cases\}\$\$/g,
    (match, content) => {
      return '\n\n$$\n\\begin{cases}\n' + content.trim() + '\n\\end{cases}\n$$\n\n';
    }
  );

  // Second: wrap unwrapped cases
  text = text.replace(
    /\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g,
    (match, content) => {
      return '\n\n$$\n\\begin{cases}\n' + content.trim() + '\n\\end{cases}\n$$\n\n';
    }
  );

  return text;
};

// ============================================================================
// TABLES
// ============================================================================

const processTables = (text) => {
  if (!text) return text;

  const tabularMatches = [];
  let searchPos = 0;

  while (true) {
    const beginPos = text.indexOf('\\begin{tabular}', searchPos);
    if (beginPos === -1) break;

    const endPos = findMatchingEnd(text, beginPos + 14);
    if (endPos === -1) break;

    tabularMatches.push({
      start: beginPos,
      end: endPos + 13,
      fullMatch: text.slice(beginPos, endPos + 13)
    });

    searchPos = endPos + 13;
  }

  let processed = text;
  for (let i = tabularMatches.length - 1; i >= 0; i--) {
    const { start, end, fullMatch } = tabularMatches[i];

    try {
      const tableData = parser.parseTabular(fullMatch);
      if (tableData && tableData.rows && tableData.rows.length > 0) {
        // Pre-render math in all cells before generating HTML
        tableData.rows.forEach(row => {
          row.forEach(cell => {
            if (cell.content) {
              cell.content = renderMathInText(cell.content);
            }
          });
        });
        
        const rendered = renderer.renderTable(tableData);
        processed = processed.slice(0, start) + rendered + processed.slice(end);
      }
    } catch (error) {
      console.warn('Error processing table:', error);
    }
  }

  return processed;
};

const findMatchingEnd = (text, startPos) => {
  let depth = 1;
  let pos = startPos;
  const beginMarker = '\\begin{tabular}';
  const endMarker = '\\end{tabular}';

  while (pos < text.length && depth > 0) {
    const nextBegin = text.indexOf(beginMarker, pos);
    const nextEnd = text.indexOf(endMarker, pos);

    if (nextEnd === -1) return -1;

    if (nextBegin !== -1 && nextBegin < nextEnd) {
      depth++;
      pos = nextBegin + beginMarker.length;
    } else {
      depth--;
      if (depth === 0) {
        return nextEnd;
      }
      pos = nextEnd + endMarker.length;
    }
  }

  return -1;
};

// ============================================================================
// FIGURES
// ============================================================================

const processFigures = (text) => {
  if (!text) return '';

  const figureRegex = /\\begin\{figure\}([\s\S]*?)\\end\{figure\}/g;

  return text.replace(figureRegex, (match, content) => {
    const imgMatch = content.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/);
    if (!imgMatch) return '';

    let imgUrl = imgMatch[1].trim();

    let caption = '';
    const captionStart = content.indexOf('\\caption{');

    if (captionStart !== -1) {
      let i = captionStart + '\\caption{'.length;
      let depth = 1;

      while (i < content.length && depth > 0) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') depth--;
        i++;
      }

      caption = content.slice(
        captionStart + '\\caption{'.length,
        i - 1
      );
    }

    // Pre-render math in caption
    const renderedCaption = renderMathInText(caption);

    return '<figure style="text-align: center; margin: 2em 0;">\n' +
      '  <img src="' + imgUrl + '" alt="Figure" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 0 auto;" />\n' +
      (renderedCaption ? '  <figcaption style="font-size: 0.95em; color: #444; margin-top: 0.75em;">' + renderedCaption + '</figcaption>\n' : '') +
      '</figure>';
  });
};

// ============================================================================
// LISTS
// ============================================================================

const processLaTeXLists = (text) => {
  text = text.replace(
    /\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g,
    (match, content) => {
      const items = content
        .split(/\\item\s/)
        .map(item => item.trim())
        .filter(item => item.length > 0);

      if (items.length === 0) return '';

      return '\n\n' + items.map(item => '- ' + item).join('\n') + '\n\n';
    }
  );

  text = text.replace(
    /\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g,
    (match, content) => {
      const items = content
        .split(/\\item\s/)
        .map(item => item.trim())
        .filter(item => item.length > 0);

      if (items.length === 0) return '';

      return '\n\n' + items.map((item, i) => (i + 1) + '. ' + item).join('\n') + '\n\n';
    }
  );

  return text;
};

// ============================================================================
// TEXT FORMATTING
// ============================================================================

const processTextFormatting = (text) => {
  text = text.replace(/\\textit\{([^}]*)\}/g, '*$1*');
  text = text.replace(/\\textbf\{([^}]*)\}/g, '**$1**');
  text = text.replace(/\\texttt\{([^}]*)\}/g, '`$1`');
  text = text.replace(/\\emph\{([^}]*)\}/g, '*$1*');
  text = text.replace(/\\underline\{([^}]*)\}/g, '<u>$1</u>');
  text = text.replace(/\\url\{([^}]*)\}/g, '[$1]($1)');

  return text;
};

// ============================================================================
// SECTIONS
// ============================================================================

const processSections = (text) => {
  text = text.replace(/\\section\{([^}]+)\}/g, '\n\n## $1\n\n');
  text = text.replace(/\\section\*\{([^}]+)\}/g, '\n\n## $1\n\n');
  text = text.replace(/\\subsection\{([^}]+)\}/g, '\n\n### $1\n\n');
  text = text.replace(/\\subsection\*\{([^}]+)\}/g, '\n\n### $1\n\n');
  text = text.replace(/\\subsubsection\{([^}]+)\}/g, '\n\n#### $1\n\n');
  text = text.replace(/\\subsubsection\*\{([^}]+)\}/g, '\n\n#### $1\n\n');

  return text;
};

// ============================================================================
// DOCUMENT COMMANDS
// ============================================================================

const processDocumentCommands = (text) => {
  text = text.replace(
    /\\title\{([^}]+)\}/g,
    '\n\n<h1 align="center">$1</h1>\n\n'
  );

  text = text.replace(
    /\\author\{([^}]+)\}/g,
    '<p align="center"><em>$1</em></p>\n\n'
  );

  text = text.replace(
    /\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/g,
    '\n\n<blockquote>\n\n**Abstract:** $1\n\n</blockquote>\n\n'
  );

  return text;
};

// ============================================================================
// CHEMISTRY (SMILES)
// ============================================================================

const processChemistry = (text) => {
  text = text.replace(
    /```smiles\n([\s\S]*?)```/g,
    '\n\n<div class="smiles-formula">`$1`</div>\n\n'
  );

  return text;
};
