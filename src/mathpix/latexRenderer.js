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
   * Render a single column table as a styled block
   */
  renderSingleColumn(rows) {
    const content = rows.map(row => {
      return row.map(cell => cell.content || '').join(' ');
    }).join('<br>');

    return '<div class="table-block">' + content + '</div>';
  }

  /**
   * Render a multi-column table with proper HTML structure
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
        const currentKey = rowIndex + '_' + colIndex;
        if (coveredCells[currentKey] && !(cell.content || '').trim()) {
          colIndex += coveredCells[currentKey].colspan || 1;
          return;
        }

        // Skip cells that are covered by rowspans from above
        while (coveredCells[rowIndex + '_' + colIndex]) {
          colIndex += coveredCells[rowIndex + '_' + colIndex].colspan || 1;
        }

        const key = rowIndex + '_' + colIndex;
        if (coveredCells[key]) {
          colIndex += coveredCells[key].colspan || 1;
          return;
        }

        const content = cell.content || '';
        const rowspan = cell.rowspan || 1;
        const colspan = cell.colspan || 1;

        // Mark future cells as covered for rowspan
        if (rowspan > 1) {
          for (let r = 1; r < rowspan; r++) {
            for (let c = 0; c < colspan; c++) {
              const futureKey = (rowIndex + r) + '_' + (colIndex + c);
              coveredCells[futureKey] = { colspan: 1 };
            }
          }
        }

        // Mark horizontally spanned cells as covered
        if (colspan > 1) {
          for (let c = 1; c < colspan; c++) {
            const spanKey = rowIndex + '_' + (colIndex + c);
            coveredCells[spanKey] = { colspan: 1 };
          }
        }

        // Determine if this is a header row
        const isHeader = rowIndex === 0 && rows.length > 1;
        const tag = isHeader ? 'th' : 'td';

        let attrs = '';
        if (rowspan > 1) attrs += ' rowspan="' + rowspan + '"';
        if (colspan > 1) attrs += ' colspan="' + colspan + '"';

        // Determine text alignment from column spec
        let textAlign = 'center';
        if (cleanColSpec && cleanColSpec[colIndex]) {
          const colChar = cleanColSpec[colIndex];
          if (colChar === 'l') textAlign = 'left';
          else if (colChar === 'r') textAlign = 'right';
          else if (colChar === 'c') textAlign = 'center';
          else if (colChar === 'p') textAlign = 'left';
        }

        const style = 'text-align: ' + textAlign + '; vertical-align: middle;' +
          (isHeader ? ' font-weight: 600; background-color: #f8fafc;' : '');

        // Content is already pre-rendered KaTeX HTML
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
