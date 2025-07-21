export function isNumber(value:any):value is Number{
    return typeof value === 'number' && !isNaN(value);
}