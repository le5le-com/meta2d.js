/*
 * @Description: 
 * @Author: 高浩然
 * @Date: 2021-10-11 16:56:45
 * @LastEditTime: 2021-10-12 11:46:58
 */
import React, { useEffect } from 'react';
import { Topology } from '@topology/core';

const TopologyContainer = () => {
  useEffect(() => {
    window.topology = new Topology('topology');
  }, []);

  return (
    <div className='main' >
      <div className="topology" id="topology"></div>
    </div>
  );
};

export default TopologyContainer;