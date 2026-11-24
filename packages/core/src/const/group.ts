/** 组合 setValue 和动画需要同步到后代的可视样式字段。 */
export const GroupStyleProps = [
  'visible', 'color', 'background', 'backgrounds', 'bkType', 'backgroundImage', 'gradient', 'opacity',
  'hoverColor', 'hoverBackground', 'activeColor', 'activeBackground', 'disabledColor', 'disabledBackground',
  'disabledTextColor', 'blur', 'blurBackground', 'lineWidth', 'lineDash', 'lineDashOffset', 'lineCap', 'lineJoin',
  'lineSmooth', 'lineGradient', 'lineType', 'lineImage', 'fromArrow', 'toArrow', 'fromArrowSize', 'toArrowSize',
  'fromArrowColor', 'toArrowColor', 'fromArrowFillColor', 'toArrowFillColor', 'fromLineCap', 'toLineCap',
  'borderWidth', 'borderColor', 'borderRadius', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY',
  'textVisible', 'fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'fontStyle', 'fontWeight', 'textShadow',
  'textShadowColor', 'textShadowBlur', 'textShadowOffsetX', 'textShadowOffsetY', 'textWidth', 'textHeight', 'textUnit',
  'textTop', 'textBottom', 'textLeft', 'textRight', 'textColor', 'textAlign', 'textVertical', 'textBackground',
  'textGradient', 'textHoverColor', 'textActiveColor', 'textFlip', 'textRotate', 'textWrap', 'ellipsis', 'keepDecimal',
  'textDecoration', 'textDecorationDash', 'textDecorationColor', 'iconTop', 'iconLeft', 'iconWidth', 'iconHeight',
  'iconRotate', 'iconColor', 'iconFamily', 'iconWeight', 'iconSize', 'iconAlign', 'iconGradient', 'pathFill',
  'vectorTint', 'imageRadius', 'progressColors',
] as const;
export const GroupStylePropSet = new Set<string>(GroupStyleProps);

export const AnimationTextLayoutKeys = new Set([
  'text', 'textVisible', 'fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'fontStyle', 'fontWeight',
  'textAlign', 'textVertical', 'textWrap', 'textWidth', 'textHeight', 'textUnit', 'textTop', 'textBottom', 'textLeft', 'textRight',
]);

export const GroupTextStyleKeySet = new Set([
  'textVisible', 'fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'fontStyle', 'fontWeight',
  'textShadow', 'textShadowColor', 'textShadowBlur', 'textShadowOffsetX', 'textShadowOffsetY', 'textWidth',
  'textHeight', 'textUnit', 'textTop', 'textBottom', 'textLeft', 'textRight', 'textColor', 'textAlign',
  'textVertical', 'textBackground', 'textGradient', 'textHoverColor', 'textActiveColor', 'textFlip', 'textRotate',
  'textWrap', 'ellipsis', 'keepDecimal', 'textDecoration', 'textDecorationDash', 'textDecorationColor',
]);
export const GroupAnimationGeometryKeys = [
  'x', 'y', 'width', 'height', 'rotate', 'pivot', 'anchors', 'container', 'scale', 'flipX', 'flipY',
] as const;
export const GroupAnimationGeometryOutputKeys = [
  'x', 'y', 'width', 'height', 'rotate', 'pivot', 'anchors', 'container', 'flipX', 'flipY',
] as const;
export const identityGroupTransform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, sx: 1, sy: 1, rotate: 0,
  flipX: false, flipY: false };
