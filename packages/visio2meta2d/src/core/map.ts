/***
 *@description 属性映射，vsdx中xml的属性映射为meta2d的相关内容
 */

const PropertiesMap =
{
  ANGLE : "Angle",
  ARC_TO : "ArcTo",
  BACKGROUND : "Background",
  BACK_PAGE : "BackPage",
  BEGIN_ARROW : "BeginArrow",
  BEGIN_ARROW_SIZE : "BeginArrowSize",
  BEGIN_X : "BeginX",
  BEGIN_Y : "BeginY",
  BOTTOM_MARGIN : "BottomMargin",
  BULLET : "Bullet",
  CASE : "Case",
  CHARACTER : "Character",
  COLOR : "Color",
  COLOR_ENTRY : "ColorEntry",
  COLORS : "Colors",
  /**
   * Specifies the color transparency used for characters in a text run.
   * The value is normalized such that a value of 1 corresponds to 100 percent.
   * A value of zero specifies that the color is completely opaque,
   * a value of one specifies that the color is completely transparent.
   */
  COLOR_TRANS : "ColorTrans",
  CONNECT : "Connect",
  CONNECTS : "Connects",
  CONNECTION : "Connection",
  CONTROL : "Control",
  DELETED : "Del",
  DOCUMENT_SHEET : "DocumentSheet",
  ELLIPSE : "Ellipse",
  ELLIPTICAL_ARC_TO : "EllipticalArcTo",
  END_ARROW : "EndArrow",
  END_ARROW_SIZE : "EndArrowSize",
  END_X : "EndX",
  END_Y : "EndY",
  FACE_NAME : "FaceName",
  FACE_NAMES : "FaceNames",
  FALSE : "0",
  FILL : "Fill",
  FILL_BKGND : "FillBkgnd",
  FILL_BKGND_TRANS : "FillBkgndTrans",
  FILL_FOREGND : "FillForegnd",
  FILL_FOREGND_TRANS : "FillForegndTrans",
  FILL_PATTERN : "FillPattern",
  FILL_STYLE : "FillStyle",
  FILL_GRADIENT_ENABLED : "FillGradientEnabled",
  FLAGS : "Flags",
  FLIP_X : "FlipX",
  FLIP_Y : "FlipY",
  FONT : "Font",
  FONT_NAME : "Name",
  FOREIGN : "Foreign",
  FROM_CELL : "FromCell",
  FROM_SHEET : "FromSheet",
  GEOM : "Geom",
  HEIGHT : "Height",
  HORIZONTAL_ALIGN : "HorzAlign",
  ID : "ID",
  INDENT_FIRST : "IndFirst",
  INDENT_LEFT : "IndLeft",
  INDENT_RIGHT : "IndRight",
  INDEX : "IX",
  LEFT_MARGIN : "LeftMargin",
  LETTER_SPACE : "Letterspace",
  LINE : "Line",
  LINE_COLOR : "LineColor",
  LINE_COLOR_TRANS : "LineColorTrans",
  LINE_PATTERN : "LinePattern",
  LINE_STYLE : "LineStyle",
  LINE_TO : "LineTo",
  LINE_WEIGHT : "LineWeight",
  LOC_PIN_X : "LocPinX",
  LOC_PIN_Y : "LocPinY",
  MASTER : "Master",
  MASTER_SHAPE : "MasterShape",
  MASTERS : "Masters",
  MOVE_TO : "MoveTo",
  NAME : "Name",
  NAME_U : "NameU",
  NO_LINE : "NoLine",
  NURBS_TO : "NURBSTo",
  PAGE : "Page",
  PAGE_HEIGHT : "PageHeight",
  PAGE_WIDTH : "PageWidth",
  PAGES : "Pages",
  PARAGRAPH : "Paragraph",
  PIN_X : "PinX",
  PIN_Y : "PinY",
  POS : "Pos",
  RGB : "RGB",
  RIGHT_MARGIN : "RightMargin",
  ROUNDING : "Rounding",
  RTL_TEXT : "RTLText",
  SIZE : "Size",
  SHAPE : "Shape",
  SHAPES : "Shapes",
  SHAPE_SHDW_SHOW : "ShapeShdwShow",
  SHDW_PATTERN : "ShdwPattern",
  SPACE_AFTER : "SpAfter",
  SPACE_BEFORE : "SpBefore",
  SPACE_LINE : "SpLine",
  STRIKETHRU : "Strikethru",
  STYLE : "Style",
  STYLE_SHEET : "StyleSheet",
  STYLE_SHEETS : "StyleSheets",
  TEXT : "Text",
  TEXT_BKGND : "TextBkgnd",
  TEXT_BLOCK : "TextBlock",
  TEXT_STYLE : "TextStyle",
  TO_PART : "ToPart",
  TO_SHEET : "ToSheet",
  TOP_MARGIN : "TopMargin",
  TRUE : "1",
  TXT_ANGLE : "TxtAngle",
  TXT_HEIGHT : "TxtHeight",
  TXT_LOC_PIN_X : "TxtLocPinX",
  TXT_LOC_PIN_Y : "TxtLocPinY",
  TXT_PIN_X : "TxtPinX",
  TXT_PIN_Y : "TxtPinY",
  TXT_WIDTH : "TxtWidth",
  TYPE : "Type",
  TYPE_GROUP : "Group",
  TYPE_SHAPE : "Shape",
  UNIQUE_ID : "UniqueID",
  VERTICAL_ALIGN : "VerticalAlign",
  WIDTH : "Width",
  X_CON : "XCon",
  X_DYN : "XDyn",
  X : "X",
  Y_CON : "YCon",
  Y_DYN : "YDyn",
  Y : "Y",
  HIDE_TEXT : "HideText",
  VSDX_ID : "vsdxID",
  CONNECT_TO_PART_WHOLE_SHAPE : 3
};

const TransFormPropertyMap = {
  NAMEU: 'name',
  NAME: 'name',
};

export class GraphMap {
  private map = basicGraphMap;
  public addGraphMapping(key:string, target:string){
    if(!key || !target)return;
    this.map[key] = target;
  }
  public deleteGraphMapping(key:string){
    delete this.map[key];
  }
  public getGraphMapping(key:string){
    return this.map[key];
  }
  public getGraphMappings(){
    return this.map;
  }
  public getGraphMappingKeys(){
    return Object.keys(this.map);
  }
  public getGraphMappingValues(){
    return Object.values(this.map);
  }
  public getGraphMappingEntries(){
    return Object.entries(this.map);
  }
}

const basicGraphMap = {
  "rectangle":"rectangle",
};
