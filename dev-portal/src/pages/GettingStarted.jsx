// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react'

// mobx
import { observer } from 'mobx-react'

// fragments
import { fragments } from 'services/get-fragments'

import { TextField } from '@michelin/acid-components'

// semantic-ui
import { Container } from 'semantic-ui-react'
import { withStyles } from '@material-ui/core/styles';

export default observer(() => (
  <Container style={{ padding: '40px' }}>
    <fragments.GettingStarted.jsx />
    <TextField
					id='text1'
					name='fldText1'
					label='fldText1'
					placeholder='fldText1'
					helperText='fldText1'
					required={false}
					error={false}
					fullWidth={false}
					disabled={false}
					readOnly={false}
				/>
  </Container>
))
