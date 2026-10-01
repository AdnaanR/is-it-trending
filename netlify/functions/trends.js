const googleTrends = require('google-trends-api');

exports.handler = async function (event) {
  const keyword = (event.queryStringParameters || {}).q;

  if (!keyword) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Missing ?q= parameter' }),
    };
  }

  try {
    const [relatedRaw, interestRaw] = await Promise.all([
      googleTrends.relatedQueries({ keyword, geo: '', hl: 'en-US' }),
      googleTrends.interestOverTime({ keyword, geo: '', hl: 'en-US' }),
    ]);

    const related = JSON.parse(relatedRaw);
    const interest = JSON.parse(interestRaw);

    /* ---- Related queries ---- */
    let topQueries = [];
    let risingQueries = [];

    if (related?.default?.rankedList) {
      const ranked = related.default.rankedList;
      if (ranked[0]?.rankedKeyword) {
        topQueries = ranked[0].rankedKeyword.slice(0, 10).map((k) => ({
          query: k.query,
          value: k.value,
          formatted: k.formattedValue,
        }));
      }
      if (ranked[1]?.rankedKeyword) {
        risingQueries = ranked[1].rankedKeyword.slice(0, 10).map((k) => ({
          query: k.query,
          value: k.value,
          formatted: k.formattedValue,
        }));
      }
    }

    /* ---- Trend direction ---- */
    let direction = 'stable';
    let currentInterest = 0;

    if (interest?.default?.timelineData?.length > 4) {
      const tl = interest.default.timelineData;
      const recent = tl.slice(-4);
      const older = tl.slice(-8, -4);

      const avg = (arr) => arr.reduce((s, d) => s + d.value[0], 0) / arr.length;
      const recentAvg = avg(recent);
      const olderAvg = older.length > 0 ? avg(older) : recentAvg;

      currentInterest = Math.round(recentAvg);
      if (recentAvg > olderAvg * 1.15) direction = 'up';
      else if (recentAvg < olderAvg * 0.85) direction = 'down';
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
      body: JSON.stringify({ keyword, direction, currentInterest, topQueries, risingQueries }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Could not fetch trend data right now. Try again in a moment.', detail: err.message }),
    };
  }
};
