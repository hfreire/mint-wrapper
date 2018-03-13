/*
 * Copyright (c) 2018, Hugo Freire <hugo@exec.sh>.
 *
 * This source code is licensed under the license found in the
 * LICENSE.md file in the root directory of this source tree.
 */

const BASE_URL = 'https://api.mint.me'

const _ = require('lodash')
const Promise = require('bluebird')

const { MintNotAuthorizedError } = require('./errors')

const Request = require('request-on-steroids')

const responseHandler = ({ statusCode, statusMessage, body }) => {
  if (body && body.error_code && body.error_code !== 0) {
    throw new Error(`${body.error_code} ${body.error_message}`)
  }

  return body
}

const defaultOptions = {
  'request-on-steroids': {
    request: {
      headers: {
        'User-Agent': 'Mint-Android/1.10.2'
      }
    },
    perseverance: {
      retry: {
        max_tries: 2,
        interval: 1000,
        timeout: 16000,
        throw_original: true,
        predicate: (error) => !(error instanceof MintNotAuthorizedError)
      },
      breaker: { timeout: 12000, threshold: 80, circuitDuration: 3 * 60 * 60 * 1000 }
    }
  }
}

class MintWrapper {
  constructor (options = {}) {
    this._options = _.defaultsDeep({}, options, defaultOptions)

    this._request = new Request(_.get(this._options, 'request-on-steroids'))
  }

  set accessToken (accessToken) {
    this._accessToken = accessToken
  }

  get accessToken () {
    return this._accessToken
  }

  set userId (userId) {
    this._userId = userId
  }

  get userId () {
    return this._userId
  }

  get circuitBreaker () {
    return this._request.circuitBreaker
  }

  authorize (facebookAccessToken) {
    return Promise.try(() => {
      if (!facebookAccessToken) {
        throw new Error('invalid arguments')
      }
    })
      .then(() => {
        const options = {
          url: `${BASE_URL}/v1/oauth`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          form: {
            oauth_provider: 'fb',
            oauth_token: facebookAccessToken
          }
        }

        return this._request.post(options, responseHandler)
          .then((data) => {
            this._accessToken = data.access_token
            this._userId = data.user_id

            return data
          })
      })
  }

  getRecommendations (latitude, longitude) {
    return Promise.try(() => {
      if (!latitude || !longitude) {
        throw new Error('invalid arguments')
      }

      if (!this._accessToken) {
        throw new MintNotAuthorizedError()
      }
    })
      .then(() => {
        const getNearby = () => {
          const options = {
            url: `${BASE_URL}/v3/me/nearby`,
            headers: {
              'X-Access-Token': this._accessToken
            },
            qs: {
              lat: latitude,
              lng: longitude,
              picture_width: 640,
              picture_height: 510,
              avatar_size: 288,
              scale: 1
            }
          }

          return this._request.get(options, responseHandler)
            .then(({ data }) => data)
        }
        const getActive = () => {
          const options = {
            url: `${BASE_URL}/v3/me/nearby?active`,
            headers: {
              'X-Access-Token': this._accessToken
            },
            qs: {
              lat: latitude,
              lng: longitude,
              picture_width: 640,
              picture_height: 510,
              avatar_size: 288,
              scale: 1
            }
          }

          return this._request.get(options, responseHandler)
            .then(({ data }) => data)
        }

        return Promise.props({ nearby: getNearby(), active: getActive() })
          .then(({ nearby, active }) => _.unionBy(nearby, active, 'id'))
      })
  }

  getAccount () {
    return Promise.try(() => {
      if (!this._accessToken) {
        throw new MintNotAuthorizedError()
      }
    })
      .then(() => {
        const options = {
          url: `${BASE_URL}/v5/me`,
          headers: {
            'X-Access-Token': this._accessToken
          },
          qs: {
            picture_width: 640,
            picture_height: 558,
            avatar_size: 288,
            interest_avatar_size: 170,
            spotify_avatar_size: 170,
            scale: 1
          }
        }

        return this._request.get(options, responseHandler)
      })
  }

  getUser (userId) {
    return Promise.try(() => {
      if (!userId) {
        throw new Error('invalid arguments')
      }

      if (!this._accessToken) {
        throw new MintNotAuthorizedError()
      }
    })
      .then(() => {
        const options = {
          url: `${BASE_URL}/v3/profiles`,
          headers: {
            'X-Access-Token': this._accessToken
          },
          qs: {
            ids: userId,
            picture_width: 640,
            picture_height: 558,
            avatar_size: 288,
            scale: 1
          }
        }

        return this._request.get(options, responseHandler)
          .then(({ data }) => _.get(data, '[0]'))
      })
  }

  getUpdates (lastActivityDate) {
    return Promise.try(() => {
      if (lastActivityDate && !_.isDate(lastActivityDate)) {
        throw new Error('invalid arguments')
      }

      if (!this._accessToken) {
        throw new MintNotAuthorizedError()
      }
    })
      .then(() => {
        const _lastActivityDate = lastActivityDate ? lastActivityDate.getTime() : undefined

        const options = {
          url: `${BASE_URL}/v5/me/sync`,
          headers: {
            'X-Access-Token': this._accessToken
          },
          qs: {
            t: _lastActivityDate,
            picture_width: 640,
            picture_height: 558,
            avatar_size: 288,
            interest_avatar_size: 170,
            spotify_avatar_size: 170,
            scale: 1
          }
        }

        return this._request.get(options, responseHandler)
      })
  }

  sendMessage (userId, chatId, message) {
    return Promise.try(() => {
      if (!(userId || chatId) || !message) {
        throw new Error('invalid arguments')
      }

      if (!this._accessToken) {
        throw new MintNotAuthorizedError()
      }
    })
      .then(() => {
        if (!chatId) {
          const options = {
            url: `${BASE_URL}/v4/me/chats`,
            headers: {
              'Authorization': `OAuth="${this._accessToken}"`,
              'Content-Type': 'application/x-www-form-urlencoded'

            },
            form: {
              id: userId
            },
            json: true
          }

          return this._request.post(options, responseHandler)
            .then(({ id }) => id)
        }

        return chatId
      })
      .then((chatId) => {
        const options = {
          url: `${BASE_URL}/v2/me/chats/${chatId}/messages/text`,
          headers: {
            'Authorization': `OAuth="${this._accessToken}"`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: {
            packet_id: 4716671047113889394, // TODO: understand how to generate
            message
          },
          json: true
        }

        return this._request.post(options, responseHandler)
      })
  }

  like (userId) {
    return Promise.try(() => {
      if (!userId) {
        throw new Error('invalid arguments')
      }

      if (!this._accessToken) {
        throw new MintNotAuthorizedError()
      }
    })
      .then(() => {
        const options = {
          url: `${BASE_URL}/v5/me/favorites`,
          headers: {
            'Authorization': `OAuth="${this._accessToken}"`,
            'Content-Type': 'application/x-www-form-urlencoded'

          },
          form: {
            id: userId
          }
        }

        return this._request.post(options, responseHandler)
      })
  }

  pass () {
    return Promise.resolve()
  }
}

module.exports = MintWrapper
