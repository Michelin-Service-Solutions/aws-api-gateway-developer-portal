// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react'
// import { Menu } from 'semantic-ui-react'
import { Link } from 'react-router-dom'

function MenuLink ({ to, ...props }) {
  if (props.onClick == null && to == null) {
    return (<Link className='link' {...props} style={{ ...props.style, cursor: 'default' }} />)
  } else if (props.onClick != null || /^https?:\/\//.test(to)) {
    // The class name here is to avoid a selector precedence issue in a few isolated cases
    return <Link className='link' as='a' href={to} {...props} />
  } else {
    return <Link className='link' to={to} {...props} />
  }
}

export default MenuLink
