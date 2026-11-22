const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const r1 = await pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'approved')::int AS approved, COUNT(*) FILTER (WHERE status = 'pending')::int AS pending, COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected, COALESCE(SUM(view_count), 0)::int AS total_views FROM research");
    const r2 = await pool.query('SELECT COUNT(*)::int AS users FROM users');
    const r3 = await pool.query('SELECT COUNT(*)::int AS programs FROM programs');
    const r6 = await pool.query('SELECT year, COUNT(*)::int AS count FROM research GROUP BY year ORDER BY year DESC LIMIT 10');
    const r7 = await pool.query('SELECT r.code, r.title, COALESCE(r.view_count, 0)::int AS views FROM research r ORDER BY COALESCE(r.view_count, 0) DESC LIMIT 10');
    const r8 = await pool.query('SELECT p.name AS program, COUNT(r.id)::int AS count FROM programs p LEFT JOIN research r ON r.program_id = p.id GROUP BY p.id, p.name ORDER BY count DESC');
    const r9 = await pool.query(`SELECT p.code AS program_code, p.name AS program_name, r.year::int AS year,
           COUNT(r.id)::int AS total,
           COUNT(*) FILTER (WHERE r.status = 'approved')::int AS approved,
           COUNT(*) FILTER (WHERE r.status = 'pending')::int AS pending,
           COUNT(*) FILTER (WHERE r.status = 'rejected')::int AS rejected,
           COALESCE(SUM(r.view_count), 0)::int AS views
         FROM research r
         LEFT JOIN programs p ON p.id = r.program_id
         GROUP BY p.code, p.name, r.year
         ORDER BY r.year DESC, p.name`);
    const r10 = await pool.query('SELECT DISTINCT year::int AS year FROM research ORDER BY year DESC');
    res.json({
      total: r1.rows[0].total, approved: r1.rows[0].approved, pending: r1.rows[0].pending, rejected: r1.rows[0].rejected, total_views: r1.rows[0].total_views,
      users: r2.rows[0].users, programs: r3.rows[0].programs,
      byYear: r6.rows.map(r => ({ year: r.year, count: r.count })),
      topViews: r7.rows.map(r => ({ code: r.code, title: r.title, views: r.views })),
      byProgram: r8.rows.map(r => ({ program: r.program, count: r.count })),
      byProgramYear: r9.rows.map(r => ({
        program_code: r.program_code,
        program_name: r.program_name,
        year: r.year,
        total: r.total,
        approved: r.approved,
        pending: r.pending,
        rejected: r.rejected,
        views: r.views
      })),
      years: r10.rows.map(r => r.year)
    });
  } catch (err) {
    console.error('[api/stats] request failed:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;