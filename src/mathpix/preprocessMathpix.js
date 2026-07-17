// preprocessMathpix.js

import LaTeXTableParser from './latexTableParser';
import LaTeXRenderer from './latexRenderer';

const parser = new LaTeXTableParser();
const renderer = new LaTeXRenderer();

/**
 * Preprocess Mathpix Markdown content
 * THIS IS THE ONLY PLACE THAT CONVERTS MATH DELIMITERS
 */
export const preprocessMathpix = (text) => {
  if (!text) return '';
  let processed = text;

  // STEP 1: Convert ALL inline math FIRST - \(...\) → $...$
  processed = processed.replace(/\\\((.*?)\\\)/gs, (match, math) => {
    const cleanMath = math.trim();
    // Use string concatenation, NOT template literals
    return ' $' + cleanMath + '$ ';
  });

  // STEP 2: Convert ALL display math - \[...\] → $$...$$
  processed = processed.replace(/\\\[(.*?)\\\]/gs, (match, math) => {
    const cleanMath = math.trim();
    // Use string concatenation, NOT template literals
    return '\n$$\n' + cleanMath + '\n$$\n';
  });

  // STEP 3: Process Figures
  processed = processFigures(processed);

  // STEP 4: Process LaTeX tables (now with math already converted)
  processed = processTables(processed);

  // STEP 5: Convert sections
  processed = processed.replace(/\\section\*\{([^}]+)\}/g, (match, p1) => {
    return '\n### ' + p1 + '\n';
  });

  // STEP 6: Only fix essential escape characters
  // Remove problematic replacements like \_ → _
  // Keep only what's absolutely necessary
  processed = processed
    .replace(/\\%/g, '%')
    .replace(/\\&/g, '&'); // Keep this for safety

  return processed;
};

/**
 * Process all tabular environments - NO MATH CONVERSION HERE
 */
const processTables = (text) => {
  if (!text) return text;
  
  let processed = text;
  
  // Find all tabular environments
  const tabularMatches = [];
  let beginPos = text.indexOf('\\begin{tabular}');
  
  while (beginPos !== -1) {
    const endPos = findMatchingEnd(text, beginPos + 14);
    if (endPos !== -1) {
      const fullMatch = text.slice(beginPos, endPos + 13);
      tabularMatches.push({
        start: beginPos,
        end: endPos + 13,
        fullMatch: fullMatch
      });
      beginPos = text.indexOf('\\begin{tabular}', endPos + 13);
    } else {
      break;
    }
  }
  
  // Process from last to first
  for (let i = tabularMatches.length - 1; i >= 0; i--) {
    const { start, end, fullMatch } = tabularMatches[i];
    
    try {
      // Parse the tabular content (math is already converted)
      const tableData = parser.parseTabular(fullMatch);
      
      if (tableData && tableData.rows && tableData.rows.length > 0) {
        // Render HTML (NO math conversion here)
        const rendered = renderer.renderTable(tableData);
        processed = processed.slice(0, start) + rendered + processed.slice(end);
      }
    } catch (error) {
      console.warn('Error processing table:', error);
    }
  }
  
  return processed;
};

/**
 * Find the matching \end{tabular}
 */
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

/**
 * Process figures - preserve image URLs
 */
const processFigures = (text) => {
  if (!text) return '';
  
  const figureRegex = /\\begin\{figure\}([\s\S]*?)\\end\{figure\}/g;
  
  return text.replace(figureRegex, (match, content) => {
    const imgMatch = content.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/);
    if (!imgMatch) return '';
    
    let imgUrl = imgMatch[1].trim();
    
    let caption = '';
    const captionMatch = content.match(/\\caption\{([\s\S]*?)\}(?!.*\\caption)/);
    if (captionMatch) {
      caption = captionMatch[1];
      // Math in captions is already converted
    }
    
    return '<figure style="text-align: center; margin: 2em 0;">\n' +
      '  <img src="' + imgUrl + '" alt="Figure" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 0 auto;" />\n' +
      (caption ? '  <figcaption style="font-size: 0.95em; color: #444; margin-top: 0.75em;">' + caption + '</figcaption>\n' : '') +
      '</figure>';
  });
};