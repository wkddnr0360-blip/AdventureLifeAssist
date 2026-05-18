export const $ = id => document.getElementById(id);
export const $$ = sel => document.querySelectorAll(sel);

export const getLogDate = (d = new Date()) => { 
    let l = new Date(d); 
    if (l.getHours() < 5) l.setDate(l.getDate() - 1); 
    return l.toISOString().split('T')[0]; 
};