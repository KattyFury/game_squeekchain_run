import {DatabaseSync} from 'node:sqlite';
export function database(file=':memory:'){
  const sqlite=new DatabaseSync(file);sqlite.exec('PRAGMA foreign_keys=ON');
  const wrap=stmt=>({bind(...args){return wrap({sql:stmt.sql,args});},async first(){return sqlite.prepare(stmt.sql).get(...(stmt.args||[]))||null;},async all(){return {results:sqlite.prepare(stmt.sql).all(...(stmt.args||[]))};},async run(){const r=sqlite.prepare(stmt.sql).run(...(stmt.args||[]));return {meta:{changes:Number(r.changes)}};}});
  return {sqlite,prepare(sql){return wrap({sql});},async batch(stmts){sqlite.exec('BEGIN');try{const results=[];for(const s of stmts)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}},close(){sqlite.close();}};
}
