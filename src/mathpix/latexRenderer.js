// latexRenderer.js

/**
 * Pure HTML renderer - NO MATH CONVERSION
 * Just takes parsed table data and renders HTML
 * Assumes math is already in $...$ or $$...$$ format
 */

class LaTeXRenderer {
  /**
   * Render a table from parsed data
   */
  renderTable(tableData) {
    if (!tableData || !tableData.rows || tableData.rows.length === 0) {
      return '';
    }
    
    const { rows, colSpec, isSingleColumn } = tableData;
    
    if (isSingleColumn) {
      return this.renderSingleColumn(rows);
    }
    
    return this.renderMultiColumn(rows, colSpec);
  }

  /**
   * Render a single column table
   */
  renderSingleColumn(rows) {
    const content = rows.map(row => {
      return row.map(cell => cell.content || '').join(' ');
    }).join('<br>');
    
    return '<div class="table-block">' + content + '</div>';
  }

  /**
   * Render a multi-column table
   */
  renderMultiColumn(rows, colSpec) {
    const cleanColSpec = colSpec ? colSpec.replace(/\|/g, '') : '';
    
    let html = '<div class="table-wrapper"><table class="mathpix-table">';
    html += '<tbody>';
    
    const coveredCells = {};
    
    rows.forEach((row, rowIndex) => {
      html += '<tr>';
      let colIndex = 0;
      
      row.forEach((cell) => {
        const key = rowIndex + '_' + colIndex;
        if (coveredCells[key]) {
          colIndex += coveredCells[key].colspan || 1;
          return;
        }
        
        const content = cell.content || '';
        const rowspan = cell.rowspan || 1;
        const colspan = cell.colspan || 1;
        
        if (rowspan > 1) {
          for (let r = 1; r < rowspan; r++) {
            const futureKey = (rowIndex + r) + '_' + colIndex;
            coveredCells[futureKey] = { colspan: colspan };
          }
        }
        
        const isHeader = rowIndex === 0 && rows.length > 1;
        const tag = isHeader ? 'th' : 'td';
        
        let attrs = '';
        if (rowspan > 1) attrs += ' rowspan="' + rowspan + '"';
        if (colspan > 1) attrs += ' colspan="' + colspan + '"';
        
        // Add data-katex attribute for manual rendering in table cells
        attrs += ' data-katex="true"';
        
        let textAlign = 'center';
        if (cleanColSpec && cleanColSpec[colIndex]) {
          const colChar = cleanColSpec[colIndex];
          if (colChar === 'l') textAlign = 'left';
          else if (colChar === 'r') textAlign = 'right';
          else if (colChar === 'c') textAlign = 'center';
        }
        
        const style = 'text-align: ' + textAlign + '; vertical-align: middle;' + (isHeader ? ' font-weight: 600; background-color: #f8fafc;' : '');
        
        // Content already has math in $...$ format
        html += '<' + tag + ' style="' + style + '"' + attrs + '>' + content + '</' + tag + '>';
        
        colIndex += colspan;
      });
      
      html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    return html;
  }
}

export default LaTeXRenderer;