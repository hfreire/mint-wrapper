# A :revolving_hearts: Mint :package: wrapper library

[![](https://github.com/hfreire/mint-wrapper/workflows/ci/badge.svg)](https://github.com/hfreire/mint-wrapper/actions?workflow=ci)
[![Coverage Status](https://coveralls.io/repos/github/hfreire/mint-wrapper/badge.svg?branch=master)](https://coveralls.io/github/hfreire/mint-wrapper?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/hfreire/mint-wrapper/badge.svg)](https://snyk.io/test/github/hfreire/mint-wrapper)
[![](https://img.shields.io/github/release/hfreire/mint-wrapper.svg)](https://github.com/hfreire/mint-wrapper/releases)
[![Version](https://img.shields.io/npm/v/mint-wrapper.svg)](https://www.npmjs.com/package/mint-wrapper)
[![Downloads](https://img.shields.io/npm/dt/mint-wrapper.svg)](https://www.npmjs.com/package/mint-wrapper)

> A Mint wrapper library.

### Features
* Retries :shit: failing requests in temporary and unexpected system and :boom: network failures :white_check_mark:
* Uses [Brakes](https://github.com/awolden/brakes) circuit breakers to :hand: fail-fast until it is safe to retry :white_check_mark:
* Supports [Bluebird](https://github.com/petkaantonov/bluebird) :bird: promises :white_check_mark:

### How to install
```
npm install mint-wrapper
```

### How to use

#### Use it in your app
Authorize Facebook account and get recommendations
```javascript
const MintWrapper = require('mint-wrapper')

const mint = new MintWrapper()
const facebookAccessToken = 'my-facebook-access-token'

mint.authorize(facebookAccessToken)
  .then(() => mint.getRecommendations())
  .then(({ results }) => console.log(results))
```

### How to contribute
You can contribute either with code (e.g., new features, bug fixes and documentation) or by [donating 5 EUR](https://paypal.me/hfreire/5). You can read the [contributing guidelines](CONTRIBUTING.md) for instructions on how to contribute with code.

All donation proceedings will go to the [Sverige för UNHCR](https://sverigeforunhcr.se), a swedish partner of the [UNHCR - The UN Refugee Agency](http://www.unhcr.org), a global organisation dedicated to saving lives, protecting rights and building a better future for refugees, forcibly displaced communities and stateless people.

### Used by
* [get-me-a-date](https://github.com/hfreire/get-me-a-date) - :heart_eyes: Help me get a :cupid: date tonight :first_quarter_moon_with_face:

### License
Read the [license](./LICENSE.md) for permissions and limitations.
