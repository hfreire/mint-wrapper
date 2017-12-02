/*
 * Copyright (c) 2017, Hugo Freire <hugo@exec.sh>.
 *
 * This source code is licensed under the license found in the
 * LICENSE.md file in the root directory of this source tree.
 */

describe('Module', () => {
  let subject
  let MintWrapper
  let MintNotAuthorizedError

  before(() => {
    MintWrapper = td.object()

    MintNotAuthorizedError = td.object()
  })

  afterEach(() => td.reset())

  describe('when loading', () => {
    beforeEach(() => {
      td.replace('../src/mint-wrapper', MintWrapper)

      td.replace('../src/errors', { MintNotAuthorizedError })

      subject = require('../src/index')
    })

    it('should export mint wrapper', () => {
      subject.should.have.property('MintWrapper', MintWrapper)
    })

    it('should export mint not authorized error', () => {
      subject.should.have.property('MintNotAuthorizedError', MintNotAuthorizedError)
    })
  })
})
