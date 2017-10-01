/*
 * Copyright (c) 2017, Hugo Freire <hugo@exec.sh>.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable promise/no-callback-in-promise */

const { MintNotAuthorizedError } = require('../src/errors')

describe('Mint Wrapper', () => {
  let subject
  let request

  before(() => {
    request = td.object([ 'defaults', 'get', 'post' ])
  })

  afterEach(() => td.reset())

  describe('when constructing', () => {
    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
    })

    it('should set default request headers', () => {
      const captor = td.matchers.captor()

      td.verify(request.defaults(captor.capture()))

      const options = captor.value
      options.should.have.nested.property('headers.User-Agent', 'Mint-Android/1.10.2')
    })
  })

  describe('when constructing and loading request', () => {
    beforeEach(() => {
      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
    })

    it('should create a request with defaults function', () => {
      subject._request.should.have.property('defaults')
      subject._request.defaults.should.be.instanceOf(Function)
    })

    it('should create a request with get function', () => {
      subject._request.should.have.property('get')
      subject._request.get.should.be.instanceOf(Function)
    })

    it('should create a request with post function', () => {
      subject._request.should.have.property('post')
      subject._request.post.should.be.instanceOf(Function)
    })
  })

  describe('when authorizing', () => {
    const facebookAccessToken = 'my-facebook-access-token'
    const statusCode = 200
    const body = require('./mint-wapper-post_oauth-response-ok.json')
    const response = { statusCode, body }

    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.when(request.post(td.matchers.anything()), { ignoreExtraArgs: true }).thenCallback(null, response)
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()

      return subject.authorize(facebookAccessToken)
    })

    it('should do a post request to https://api.mint.me/v1/oauth', () => {
      const captor = td.matchers.captor()

      td.verify(request.post(captor.capture()), { ignoreExtraArgs: true, times: 1 })

      const options = captor.value
      options.should.have.property('url', 'https://api.mint.me/v1/oauth')
    })

    it('should do a post request with form', () => {
      const captor = td.matchers.captor()

      td.verify(request.post(captor.capture()), { ignoreExtraArgs: true, times: 1 })

      const options = captor.value
      options.should.have.nested.property('form.oauth_provider', 'fb')
      options.should.have.nested.property('form.oauth_token', facebookAccessToken)
    })

    it('should set access token', () => {
      subject.accessToken.should.be.equal(body.access_token)
    })

    it('should set user id', () => {
      subject.userId.should.be.equal(body.user_id)
    })
  })

  describe('when authorizing with invalid facebook access token', () => {
    const facebookAccessToken = undefined

    beforeEach(() => {
      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
    })

    it('should reject with invalid arguments error', () => {
      return subject.authorize(facebookAccessToken)
        .catch((error) => {
          error.should.be.instanceOf(Error)
          error.message.should.be.equal('invalid arguments')
        })
    })
  })

  describe('when getting recommendations', () => {
    const latitude = 'my-latitude'
    const longitude = 'my-longitude'
    const statusCode = 200
    const accessToken = 'my-access-token'
    const nearbyBody = require('./mint-wrapper-get_nearby-response-ok.json')
    const nearbyActiveBody = require('./mint-wrapper-get_nearby_active-response-ok.json')

    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.when(request.get(td.matchers.contains({ url: 'https://api.mint.me/v3/me/nearby' })), { ignoreExtraArgs: true }).thenCallback(null, {
        statusCode,
        body: nearbyBody
      })
      td.when(request.get(td.matchers.contains({ url: 'https://api.mint.me/v3/me/nearby?active' })), { ignoreExtraArgs: true }).thenCallback(null, {
        statusCode,
        body: nearbyActiveBody
      })
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
      subject.accessToken = accessToken
    })

    it('should resolve with response body as data', () => {
      return subject.getRecommendations(latitude, longitude)
        .then((data) => {
          data.should.have.lengthOf(_.unionBy(nearbyBody.data, nearbyActiveBody.data, 'id').length)
        })
    })
  })

  describe('when getting recommendations with invalid latitude and longitude', () => {
    const latitude = undefined
    const longitude = undefined
    const accessToken = 'my-access-token'

    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
      subject.accessToken = accessToken
    })

    it('should reject with invalid arguments error', () => {
      return subject.getRecommendations(latitude, longitude)
        .catch((error) => {
          error.should.be.instanceOf(Error)
          error.message.should.be.equal('invalid arguments')
        })
    })
  })

  describe('when getting recommendations and not authorized', () => {
    const latitude = 0.1
    const longitude = 0.1
    const statusCode = 401
    const body = {}
    const response = { statusCode, body }

    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.when(request.get(td.matchers.anything()), { ignoreExtraArgs: true }).thenCallback(null, response)
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
    })

    it('should reject with mint not authorized error', () => {
      return subject.getRecommendations(latitude, longitude)
        .catch((error) => {
          error.should.be.instanceOf(MintNotAuthorizedError)
        })
    })
  })

  describe('when getting account', () => {
    const statusCode = 200
    const body = require('./mint-wrapper-get_me-response-ok.json')
    const response = { statusCode, body }
    const accessToken = 'my-access-token'

    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.when(request.get(td.matchers.anything()), { ignoreExtraArgs: true }).thenCallback(null, response)
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
      subject.accessToken = accessToken
    })

    it('should do a get request to https://api.mint.me/v5/me', () => {
      return subject.getAccount()
        .then(() => {
          const captor = td.matchers.captor()

          td.verify(request.get(captor.capture()), { ignoreExtraArgs: true, times: 1 })

          const options = captor.value
          options.should.have.property('url', 'https://api.mint.me/v5/me')
          options.should.have.nested.property('qs.picture_width', 640)
          options.should.have.nested.property('qs.picture_height', 558)
          options.should.have.nested.property('qs.avatar_size', 288)
          options.should.have.nested.property('qs.interest_avatar_size', 170)
          options.should.have.nested.property('qs.spotify_avatar_size', 170)
          options.should.have.nested.property('qs.scale', 1)
        })
    })

    it('should resolve with response body as data', () => {
      return subject.getAccount()
        .then((data) => {
          data.should.be.equal(body)
        })
    })
  })

  describe('when getting account and not authorized', () => {
    beforeEach(() => {
      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
    })

    it('should reject with tinder not authorized error', (done) => {
      subject.getAccount()
        .catch((error) => {
          error.should.be.instanceOf(MintNotAuthorizedError)

          done()
        })
    })
  })

  describe('when getting user', () => {
    const userId = 'my-user-id'
    const statusCode = 200
    const body = require('./mint-wrapper-get_profiles-response-ok.json')
    const response = { statusCode, body }
    const accessToken = 'my-access-token'

    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.when(request.get(td.matchers.anything()), { ignoreExtraArgs: true }).thenCallback(null, response)
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
      subject.accessToken = accessToken
    })

    it('should do a get request to https://api.mint.me/v3/profiles/my-user-id', () => {
      return subject.getUser(userId)
        .then(() => {
          const captor = td.matchers.captor()

          td.verify(request.get(captor.capture()), { ignoreExtraArgs: true, times: 1 })

          const options = captor.value
          options.should.have.property('url', 'https://api.mint.me/v3/profiles/my-user-id')
          options.should.have.nested.property('qs.picture_width', 640)
          options.should.have.nested.property('qs.picture_height', 558)
          options.should.have.nested.property('qs.avatar_size', 288)
          options.should.have.nested.property('qs.interest_avatar_size', 170)
          options.should.have.nested.property('qs.spotify_avatar_size', 170)
          options.should.have.nested.property('qs.scale', 1)
        })
    })

    it('should resolve with response body as data', () => {
      return subject.getUser(userId)
        .then((data) => {
          data.should.be.equal(body)
        })
    })
  })

  describe('when getting user and not authorized', () => {
    const userId = 'my-user-id'

    beforeEach(() => {
      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
    })

    it('should reject with tinder not authorized error', (done) => {
      subject.getUser(userId)
        .catch((error) => {
          error.should.be.instanceOf(MintNotAuthorizedError)

          done()
        })
    })
  })

  describe('when getting user with invalid id', () => {
    const userId = undefined
    const accessToken = 'my-access-token'

    beforeEach(() => {
      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
      subject.accessToken = accessToken
    })

    it('should reject with invalid arguments error', () => {
      return subject.getUser(userId)
        .catch((error) => {
          error.should.be.instanceOf(Error)
          error.message.should.be.equal('invalid arguments')
        })
    })
  })

  describe('when getting updates without a last activity date', () => {
    const statusCode = 200
    const body = require('./mint-wrapper-get_sync-response-ok.json')
    const response = { statusCode, body }
    const accessToken = 'my-access-token'

    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.when(request.get(td.matchers.anything()), { ignoreExtraArgs: true }).thenCallback(null, response)
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
      subject.accessToken = accessToken
    })

    it('should do a get request to https://api.mint.me/v5/me/sync', () => {
      return subject.getUpdates()
        .then(() => {
          const captor = td.matchers.captor()

          td.verify(request.get(captor.capture()), { ignoreExtraArgs: true, times: 1 })

          const options = captor.value
          options.should.have.property('url', 'https://api.mint.me/v5/me/sync')
          options.should.have.nested.property('qs.t')
          options.qs.t.should.be.closeTo(new Date().getTime(), 60000)
          options.should.have.nested.property('qs.picture_width', 640)
          options.should.have.nested.property('qs.picture_height', 558)
          options.should.have.nested.property('qs.avatar_size', 288)
          options.should.have.nested.property('qs.interest_avatar_size', 170)
          options.should.have.nested.property('qs.spotify_avatar_size', 170)
          options.should.have.nested.property('qs.scale', 1)
        })
    })
  })

  describe('when getting updates with a last activity date', () => {
    const lastActivityDate = new Date()
    const statusCode = 200
    const body = require('./mint-wrapper-get_sync-response-ok.json')
    const response = { statusCode, body }
    const accessToken = 'my-access-token'

    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.when(request.get(td.matchers.anything()), { ignoreExtraArgs: true }).thenCallback(null, response)
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
      subject.accessToken = accessToken
    })

    it('should do a get request to https://api.mint.me/v5/me/sync', () => {
      return subject.getUpdates(lastActivityDate)
        .then(() => {
          const captor = td.matchers.captor()

          td.verify(request.get(captor.capture()), { ignoreExtraArgs: true, times: 1 })

          const options = captor.value
          options.should.have.nested.property('qs.t', lastActivityDate.getTime())
        })
    })
  })

  describe('when getting updates with invalid last activity date', () => {
    const lastActivityDate = null
    const accessToken = 'my-access-token'

    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
      subject.accessToken = accessToken
    })

    it('should reject with invalid arguments error', () => {
      return subject.getUpdates(lastActivityDate)
        .catch((error) => {
          error.should.be.instanceOf(Error)
          error.message.should.be.equal('invalid arguments')
        })
    })
  })

  describe('when getting updates and not authorized', () => {
    beforeEach(() => {
      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
    })

    it('should reject with tinder not authorized error', (done) => {
      subject.getUpdates()
        .catch((error) => {
          error.should.be.instanceOf(MintNotAuthorizedError)

          done()
        })
    })
  })

  describe('when sending message without a chat', () => {
    const userId = 'my-user-id'
    const chatId = undefined
    const message = 'my-message'
    const statusCode = 200
    const bodyChats = require('./mint-wrapper-post_chats-response-ok.json')
    const bodyMessages = require('./mint-wrapper-post_messages-response-ok.json')
    const accessToken = 'my-access-token'

    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.when(request.post(td.matchers.contains({ url: 'https://api.mint.me/v4/me/chats' })), { ignoreExtraArgs: true }).thenCallback(null, { statusCode, body: bodyChats })
      td.when(request.post(td.matchers.contains({ url: `https://api.mint.me/v2/me/chats/${bodyChats.id}/messages/text` })), { ignoreExtraArgs: true }).thenCallback(null, { statusCode, body: bodyMessages })
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
      subject.accessToken = accessToken
    })

    it('should resolve with response body as data', () => {
      return subject.sendMessage(userId, chatId, message)
        .then((data) => {
          data.should.be.equal(bodyMessages)
        })
    })
  })

  describe('when sending message with a chat', () => {
    const userId = 'my-user-id'
    const chatId = 'my-chat-id'
    const message = 'my-message'
    const statusCode = 200
    const body = require('./mint-wrapper-post_messages-response-ok.json')
    const response = { statusCode, body }
    const accessToken = 'my-access-token'

    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.when(request.post(td.matchers.contains({ url: `https://api.mint.me/v2/me/chats/${chatId}/messages/text` })), { ignoreExtraArgs: true }).thenCallback(null, response)
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
      subject.accessToken = accessToken
    })

    it('should resolve with response body as data', () => {
      return subject.sendMessage(userId, chatId, message)
        .then((data) => {
          data.should.be.equal(body)
        })
    })
  })

  describe('when sending message and not authorized', () => {
    const userId = 'my-user-id'
    const chatId = 'my-chat-id'
    const message = 'my-message'

    beforeEach(() => {
      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
    })

    it('should reject with tinder not authorized error', (done) => {
      subject.sendMessage(userId, chatId, message)
        .catch((error) => {
          error.should.be.instanceOf(MintNotAuthorizedError)

          done()
        })
    })
  })

  describe('when sending a message with invalid user, chat and message', () => {
    const userId = undefined
    const chatId = undefined
    const message = undefined
    const accessToken = 'my-access-token'

    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
      subject.accessToken = accessToken
    })

    it('should reject with invalid arguments error', () => {
      return subject.sendMessage(userId, chatId, message)
        .catch((error) => {
          error.should.be.instanceOf(Error)
          error.message.should.be.equal('invalid arguments')
        })
    })
  })

  describe('when liking', () => {
    const userId = 'my-user-id'
    const statusCode = 200
    const body = require('./mint-wrapper-post_favorites-response-ok.json')
    const response = { statusCode, body }
    const accessToken = 'my-access-token'

    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.when(request.post(td.matchers.anything()), { ignoreExtraArgs: true }).thenCallback(null, response)
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
      subject.accessToken = accessToken
    })

    it('should do a post request to https://api.mint.me/v5/me/favorites', () => {
      return subject.like(userId)
        .then(() => {
          const captor = td.matchers.captor()

          td.verify(request.post(captor.capture()), { ignoreExtraArgs: true, times: 1 })

          const options = captor.value
          options.should.have.property('url', 'https://api.mint.me/v5/me/favorites')
          options.should.have.nested.property('form.id', userId)
        })
    })

    it('should resolve with response body as data', () => {
      return subject.like(userId)
        .then((data) => {
          data.should.be.equal(body)
        })
    })
  })

  describe('when liking with invalid user id', () => {
    const userId = undefined

    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
    })

    it('should reject with invalid arguments error', () => {
      return subject.like(userId)
        .catch((error) => {
          error.should.be.instanceOf(Error)
          error.message.should.be.equal('invalid arguments')
        })
    })
  })

  describe('when liking and not authorized', () => {
    const userId = 'my-user-id'

    beforeEach(() => {
      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
    })

    it('should reject with mint not authorized error', (done) => {
      subject.like(userId)
        .catch((error) => {
          error.should.be.instanceOf(MintNotAuthorizedError)

          done()
        })
    })
  })

  describe('when passing', () => {
    const userId = 'my-user-id'

    beforeEach(() => {
      td.when(request.defaults(), { ignoreExtraArgs: true }).thenReturn(request)
      td.replace('request', request)

      const MintWrapper = require('../src/mint-wrapper')
      subject = new MintWrapper()
    })

    it('should resolve', () => {
      return subject.pass(userId)
    })
  })
})
