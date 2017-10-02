/*
 * Copyright (c) 2017, Hugo Freire <hugo@exec.sh>.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

const BASE_URL = 'https://api.mint.me'

const _ = require('lodash')
const Promise = require('bluebird')
const retry = require('bluebird-retry')
const Brakes = require('brakes')

const { MintNotAuthorizedError } = require('./errors')

const request = require('request')

const handleResponse = ({ body }) => {
  let _body = body
  if (_.isString(_body)) {
    _body = JSON.parse(_body)
  }

  if (_body.error_code && _body.error_code !== 0) {
    throw new Error(`${_body.error_code} ${_body.error_message}`)
  }

  return _body
}

const defaultOptions = {
  request: {
    headers: {
      'User-Agent': 'Mint-Android/1.10.2'
    }
  },
  retry: {
    max_tries: 2,
    interval: 3000,
    timeout: 24000,
    throw_original: true,
    predicate: (error) => !(error instanceof MintNotAuthorizedError)
  },
  breaker: { timeout: 64000, threshold: 80, circuitDuration: 3 * 60 * 60 * 1000 }
}

class MintWrapper {
  constructor (options = {}) {
    this._options = _.defaultsDeep(options, defaultOptions)

    this._request = Promise.promisifyAll(request.defaults(this._options.request))

    this._breaker = new Brakes(this._options.breaker)

    this._getRequestCircuitBreaker = this._breaker.slaveCircuit((...params) => retry(() => this._getRequest(...params), this._options.retry))
    this._postRequestCircuitBreaker = this._breaker.slaveCircuit((...params) => retry(() => this._postRequest(...params), this._options.retry))

    this._getRequest = (...params) => {
      return this._request.getAsync(...params)
        .then((response) => {
          const { statusCode, statusMessage } = response

          if (statusCode >= 300) {
            switch (statusCode) {
              case 401:
              case 410:
                throw new MintNotAuthorizedError()
              default:
                throw new Error(`${statusCode} ${statusMessage}`)
            }
          }

          return response
        })
    }
    this._postRequest = (...params) => {
      return this._request.postAsync(...params)
        .then((response) => {
          const { statusCode, statusMessage } = response

          if (statusCode >= 300) {
            switch (statusCode) {
              case 401:
              case 410:
                throw new MintNotAuthorizedError()
              default:
                throw new Error(`${statusCode} ${statusMessage}`)
            }
          }

          return response
        })
    }
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
    return this._breaker
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

        return this._postRequestCircuitBreaker.exec(options)
          .then((response) => handleResponse(response))
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

          return this._getRequestCircuitBreaker.exec(options)
            .then((response) => handleResponse(response))
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

          return this._getRequestCircuitBreaker.exec(options)
            .then((response) => handleResponse(response))
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

        return this._getRequestCircuitBreaker.exec(options)
          .then((response) => handleResponse(response))
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

        return this._getRequestCircuitBreaker.exec(options)
          .then((response) => handleResponse(response))
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

        return this._getRequestCircuitBreaker.exec(options)
          .then((response) => handleResponse(response))
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

          return this._postRequestCircuitBreaker.exec(options)
            .then((response) => handleResponse(response))
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

        return this._postRequestCircuitBreaker.exec(options)
          .then((response) => handleResponse(response))
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

        return this._postRequestCircuitBreaker.exec(options)
          .then((response) => handleResponse(response))
      })
  }

  pass () {
    return Promise.resolve()
  }
}

module.exports = MintWrapper
