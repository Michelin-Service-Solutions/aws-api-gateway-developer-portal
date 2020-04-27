// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react'
// import { Menu } from 'semantic-ui-react'

import {
  isAdmin,
  isAuthenticated,
  isRegistered,
  logout,
  getLoginRedirectUrl
} from 'services/self'

import {
  AppBar,
  Menu,
  IconButton,
  NotificationsIcon,
  Button,
  Link
} from '@michelin/acid-components'


import { cognitoDomain, cognitoClientId } from '../services/api'

// mobx
import { observer } from 'mobx-react'

// fragments
import { fragments } from 'services/get-fragments'

// components
import MenuLink from 'components/MenuLink'

function getCognitoUrl(type) {
  const redirectUri = getLoginRedirectUrl()
  return `${cognitoDomain}/${type}?response_type=token&client_id=${cognitoClientId}&redirect_uri=${redirectUri}`
}


export const NavBar = observer(
  class NavBar extends React.Component {
    render() {
      return (
        <AppBar fixed={false}>
          <MenuLink to='/'>
            <img src='/custom-content/nav-logo.png' style={{ height: '40px', paddingRight: '10px' }} />
          </MenuLink>
          <MenuLink to='/' style={{ fontWeight: 700, marginRight: '.5rem' }}>{fragments.Home.title}</MenuLink>
          {/* <UserAvatar name={'ayelen'} email={'ayelen'} description={'description'} image={''} color={'default'} avatarPosition={'left'} /> */}
          <div style={{ display: 'inline-block', flexGrow: 1 }}>
            <MenuLink to='/getting-started' style={{ paddingRight: '10px' }}>{fragments.GettingStarted.title}</MenuLink>
            <MenuLink to='/apis' style={{ paddingRight: '10px' }}>{fragments.APIs.title}</MenuLink>
          </div>
          <div position='right'>
            {isAuthenticated() ? <>
              {isAdmin() && <MenuLink to='/admin/apis' style={{ paddingRight: '10px' }}>Admin Panel</MenuLink>}
              {isRegistered() && <MenuLink to='/dashboard' style={{ paddingRight: '10px' }}>My Dashboard</MenuLink>}
              <Button onClick={logout}>Sign Out</Button>
            </> : <>
                <Button href={getCognitoUrl('login')}>Sign In</Button>
                <Button href={getCognitoUrl('signup')}>Register</Button>
              </>}
          </div>
        </AppBar>
      )
      // return <Menu inverted borderless attached style={{ flex: '0 0 auto' }} stackable>
      //   <MenuLink to='/'>
      //     <Image size='mini' src='/custom-content/nav-logo.png' style={{ paddingRight: '10px' }} />
      //     {fragments.Home.title}
      //   </MenuLink>

      //   <MenuLink to='/getting-started'>{fragments.GettingStarted.title}</MenuLink>
      //   <MenuLink to='/apis'>{fragments.APIs.title}</MenuLink>

      //   <Menu.Menu position='right'>
      //     {isAuthenticated() ? <>
      //       {isAdmin() && <MenuLink to='/admin/apis'>Admin Panel</MenuLink>}
      //       {isRegistered() && <MenuLink to='/dashboard'>My Dashboard</MenuLink>}
      //       <MenuLink onClick={logout}>Sign Out</MenuLink>
      //     </> : <>
      //       <MenuLink to={getCognitoUrl('login')}>Sign In</MenuLink>
      //       <MenuLink to={getCognitoUrl('signup')}>Register</MenuLink>
      //     </>}
      //   </Menu.Menu>
      // </Menu>
    }
  }
)

export default NavBar
