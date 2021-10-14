/*
 * @Description: 
 * @Author: 高浩然
 * @Date: 2021-10-11 16:40:27
 * @LastEditTime: 2021-10-12 16:54:20
 */
import React, { useCallback } from 'react';
import { icons } from '../utils/data';

const Icons = () => {
  const onDragStart = useCallback((e, data) => {
    e.dataTransfer.setData('Text', JSON.stringify(data));
  }, []);

  return (
    <div className="aside" >
      <div className="icon-list" >
        { icons.map((icon) => {
          const { key, title, data } = icon;
          return (
            <div
              key = { key }
            >
              <i
                draggable
                className = { `iconfont icon-${ key }` }
                title = { title }
                onDragStart = { (e) => onDragStart(e, data) }
              ></i>
            </div>
          );
        }) }
      </div>
      <div className="link" >
        <a href = "http://topology.le5le.com/workspace/">去官网</a>
      </div>
    </div>
  );
};

export default Icons;