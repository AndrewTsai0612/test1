// ============================================================
//  nl-todo.js — Natural language parser for todo entries
//
//  Depends on: nl-expense.js  (uses NLExpense.parseDate)
//
//  Usage:  NLTodo.parse("緊急明天開會")
//  Returns: { text, priority, dueDate } | null
// ============================================================
const NLTodo = {

  parse(text) {
    if (!text || !text.trim()) return null;

    // 1. Detect priority ----------------------------------------
    // Keywords that push priority up or down
    let priority = 'medium';
    if (/緊急|urgent|重要|ASAP|asap|馬上|立刻|今天要|今天必須/.test(text)) priority = 'high';
    if (/有空|順便|不急|隨時|之後再/.test(text))                            priority = 'low';

    // 2. Parse due date -----------------------------------------
    // Only set dueDate if an explicit date keyword was found in the text.
    // Reuses NLExpense.parseDate so both parsers stay in sync.
    const { date, matched: dateMatched } = NLExpense.parseDate(text);
    const dueDate = dateMatched ? date : null;

    // 3. Clean up display text ----------------------------------
    // Remove date markers and priority noise so the stored task text is clean.
    let cleanText = text;
    if (dateMatched) cleanText = cleanText.replace(dateMatched, '').trim();
    cleanText = cleanText
      .replace(/緊急|重要|不急|有空|順便|隨時|之後再/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return { text: cleanText || text.trim(), priority, dueDate };
  },
};
