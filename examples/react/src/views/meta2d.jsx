/*
 * @Description: 
 * @Author: 高浩然
 * @Date: 2021-10-11 16:56:45
 * @LastEditTime: 2021-10-12 11:46:58
 */
import React, { useEffect } from 'react';
import { Meta2d } from '@meta2d/core';

const Meta2dContainer = () => {
  useEffect(() => {
    window.meta2d = new Meta2d('meta2d');
  }, []);

  return (
    <div className='main' >
      <div className="meta2d" id="meta2d"></div>
    </div>
  );
};

export default Meta2dContainer;