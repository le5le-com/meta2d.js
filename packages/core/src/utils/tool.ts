export function isNumber(value:any):value is Number{
    return typeof value === 'number' && !isNaN(value);
}

/**
 * @description 判断是否为空文本，null、undefined、空字符串、空格字符串、false、NaN等都视为“空文本”,0和"0"不视为“空文本”
 * @author Joseph Ho
 * @date 29/07/2025
 * @export
 * @param {*} text
 * @returns {*}  {boolean}
 */
export function isEmptyText(text) {
    // 检查是否为null或undefined
    if (text == null) {
        return true;
    }
    
    // 检查是否为字符串且去除空格后为空
    if (typeof text === 'string' && text.trim() === '') {
        return true;
    }
    
    // 检查是否为非0的假值（如NaN、false等）
    if (!text && text !== 0 && text !== '0' && text !== false) {
        return true;
    }
    
    // 其他情况（包括0和"0"）都视为非空
    return false;
}