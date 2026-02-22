// ============================================================
//  nl-expense.js — Natural language parser for expense entries
//
//  Usage:  NLExpense.parse("午餐花了50塊")
//  Returns: { amount, type, category, date, note } | null
//
//  NLExpense.parseDate(text) is also used by nl-todo.js.
// ============================================================
const NLExpense = {
  _weekdayMap: { '日':0, '天':0, '一':1, '二':2, '三':3, '四':4, '五':5, '六':6 },

  // ── Date parsing ──────────────────────────────────────────
  // Returns { date: 'YYYY-MM-DD', matched: string | null }
  // `matched` is the substring consumed from the original text.
  parseDate(text) {
    const today = dayjs();

    // Relative day keywords
    const simpleOffsets = {
      '大前天': -3, '前天': -2, '昨天': -1, '昨日': -1,
      '今天': 0,   '今日': 0,  '今': 0,
      '明天': 1,   '明日': 1,  '後天': 2,
    };
    for (const [kw, offset] of Object.entries(simpleOffsets)) {
      if (text.includes(kw)) {
        return { date: today.add(offset, 'day').format('YYYY-MM-DD'), matched: kw };
      }
    }

    // 上週X / 上個禮拜X
    const lwm = text.match(/上(?:個)?(?:週|星期|禮拜)([一二三四五六日天])/);
    if (lwm) {
      const wd = this._weekdayMap[lwm[1]] ?? -1;
      if (wd !== -1)
        return { date: today.subtract(1, 'week').day(wd).format('YYYY-MM-DD'), matched: lwm[0] };
    }

    // 這週X / 本週X
    const twm = text.match(/(?:這|本)(?:週|星期|禮拜)([一二三四五六日天])/);
    if (twm) {
      const wd = this._weekdayMap[twm[1]] ?? -1;
      if (wd !== -1)
        return { date: today.day(wd).format('YYYY-MM-DD'), matched: twm[0] };
    }

    // 下週X
    const nwm = text.match(/下(?:個)?(?:週|星期|禮拜)([一二三四五六日天])/);
    if (nwm) {
      const wd = this._weekdayMap[nwm[1]] ?? -1;
      if (wd !== -1)
        return { date: today.add(1, 'week').day(wd).format('YYYY-MM-DD'), matched: nwm[0] };
    }

    // X月X日 / X月X號
    const mdm = text.match(/(\d{1,2})月(\d{1,2})[日號]?/);
    if (mdm) {
      const m = String(parseInt(mdm[1])).padStart(2, '0');
      const d = String(parseInt(mdm[2])).padStart(2, '0');
      let yr = today.year();
      if (dayjs(`${yr}-${m}-${d}`).isAfter(today.add(2, 'month'))) yr -= 1;
      return { date: `${yr}-${m}-${d}`, matched: mdm[0] };
    }

    // X/X  (month/day shorthand — skip if looks like a time HH:MM)
    const slm = text.match(/(\d{1,2})\/(\d{1,2})(?!\d*:)/);
    if (slm) {
      const mo = parseInt(slm[1]); const dy = parseInt(slm[2]);
      if (mo >= 1 && mo <= 12 && dy >= 1 && dy <= 31) {
        const m = String(mo).padStart(2,'0'); const d = String(dy).padStart(2,'0');
        let yr = today.year();
        if (dayjs(`${yr}-${m}-${d}`).isAfter(today.add(2, 'month'))) yr -= 1;
        return { date: `${yr}-${m}-${d}`, matched: slm[0] };
      }
    }

    return { date: today.format('YYYY-MM-DD'), matched: null };
  },

  // ── Main parse entry point ─────────────────────────────────
  parse(text) {
    if (!text || !text.trim()) return null;

    // 1. Extract amount ----------------------------------------
    // Priority: number+currency-word  >  symbol+number  >  largest bare number
    let amount = null;
    let amountMatched = null;

    const ww = text.match(/(\d+(?:\.\d{1,2})?)\s*(?:元|塊|块|円)/);
    const ws = text.match(/(?:NT\$|\$)(\d+(?:\.\d{1,2})?)/);

    if (ww) {
      amount = parseFloat(ww[1]); amountMatched = ww[0];
    } else if (ws) {
      amount = parseFloat(ws[1]); amountMatched = ws[0];
    } else {
      // Take the largest standalone number (reduces false positives like "買了3包")
      const re = /(\d+(?:\.\d{1,2})?)/g;
      let largest = 0, m;
      while ((m = re.exec(text)) !== null) {
        const n = parseFloat(m[1]);
        if (n > largest) { largest = n; amountMatched = m[0]; }
      }
      if (largest > 0) amount = largest;
    }

    if (!amount || amount <= 0) return null;

    // 2. Detect type (income vs expense) -----------------------
    let type = 'expense';
    const incKws = ['收到','收入','薪水','薪資','工資','月薪','獎金','紅利',
                    '退款','退稅','利息','股息','分紅','賺','領到','入帳'];
    for (const kw of incKws) {
      if (text.includes(kw)) { type = 'income'; break; }
    }

    // 3. Parse date --------------------------------------------
    const { date, matched: dateMatched } = this.parseDate(text);

    // 4. Detect category ---------------------------------------
    const category = type === 'income'
      ? this._detectIncomeCategory(text)
      : this._detectExpenseCategory(text);

    // 5. Build note: strip structural words from original text -
    let note = text;
    if (amountMatched) note = note.replace(amountMatched, '');
    if (dateMatched)   note = note.replace(dateMatched, '');
    note = note
      .replace(/花了?|付了?|買了?|收到|消費了?|花費了?|支出了?|領到|賺了?|支付了?/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return { amount, type, category, date, note };
  },

  // ── Category detection rules ──────────────────────────────
  _detectExpenseCategory(text) {
    const t = text.toLowerCase();
    const rules = [
      { cat: '餐飲', kws: ['吃','喝','餐','飯','麵','便當','咖啡','奶茶','早餐','午餐',
          '晚餐','宵夜','飲料','火鍋','炸雞','珍奶','滷味','蛋糕','麵包','壽司',
          '拉麵','牛排','燒烤','甜點','下午茶','早午餐','點心'] },
      { cat: '交通', kws: ['捷運','公車','火車','高鐵','計程車','uber','油錢','停車',
          '加油','機票','台鐵','高速','過路費','mrt','bus','腳踏車','gogoro','汽車'] },
      { cat: '購物', kws: ['衣服','鞋子','包包','手機','電腦','3c','超市','賣場','百貨',
          '蝦皮','amazon','服飾','飾品','筆電','耳機','充電器','家電','傢俱','日用品','電腦','主機板'] },
      { cat: '娛樂', kws: ['電影','ktv','遊戲','音樂','演唱會','展覽','漫畫','netflix',
          'spotify','youtube','夜店','酒吧','桌遊','密室','健身','游泳','電玩','livehouse','書'] },
      { cat: '醫療', kws: ['醫院','診所','藥局','藥','掛號','看診','牙醫','健保','保險','眼科','復健'] },
      { cat: '住房', kws: ['房租','水電','瓦斯','網路費','管理費','電費','水費','租金','寬頻','第四台'] },
      { cat: '教育', kws: ['補習','課程','學費','書本','教材','考試','證照','線上課'] },
    ];
    for (const { cat, kws } of rules) {
      for (const kw of kws) {
        if (t.includes(kw)) return cat;
      }
    }
    return '其他';
  },

  _detectIncomeCategory(text) {
    const t = text.toLowerCase();
    const rules = [
      { cat: '薪水', kws: ['薪水','薪資','工資','月薪','底薪'] },
      { cat: '兼職', kws: ['兼職','打工','案子','接案','外快','freelance'] },
      { cat: '投資', kws: ['股票','基金','投資','利息','股息','分紅','配息'] },
      { cat: '禮金', kws: ['紅包','禮金','壓歲錢','獎金','獎勵','退款','退稅'] },
    ];
    for (const { cat, kws } of rules) {
      for (const kw of kws) {
        if (t.includes(kw)) return cat;
      }
    }
    return '其他';
  },
};
