import { makeRetryUnlimited } from './keepConnection'

const rt = [
    () => (Math.random() * 100 + 100),
    () => (Math.random() * 1000 + 1000),
    () => (Math.random() * 5000 + 1000),
]

console.log2 = (...args) => {
    console.log(...args, new Date())
}

const randomRT = () => (rt[Math.floor(Math.random() * 3)]())

const randomInterval = () => (10000)

const RequestErrorType = Object.freeze({
    INIT: 1,
    SUCCESS: 2,
    FAILED: 3,
    DISCARD: 4,
})

const request = (data, rqCallback, options = { proportion: 0.3 }) => {
    const rtTemp = randomRT()
    return new Promise((resolve) => {
        setTimeout(() => {
            if (Math.random() > options.proportion) {
                rqCallback({ type: RequestErrorType.SUCCESS, rt: rtTemp })

                const dataTemp = { interval: randomInterval() }
                resolve([null, dataTemp])
            } else {
                rqCallback({ type: RequestErrorType.FAILED, rt: rtTemp })
                resolve([{ message: 'request failed' }])
            }
        }, rtTemp)
    })
}

test('makeRetryUnlimited test', (done) => {
    const requestRTQueue = []
    const r = (data) => {
        const requestStartTime = new Date().getTime()

        const requestItemInfo = {
            type: RequestErrorType.INIT, rt: -1, data: null,
            start: requestStartTime, end: -1,
            discard: -1,
        }

        requestRTQueue.push(requestItemInfo)

        return request(data, ({ type, rt: rtTemp }) => {
            // collection info
            const requestEndTime = new Date().getTime()

            if (requestItemInfo.type === RequestErrorType.INIT) {
                requestItemInfo.type = type
                requestItemInfo.rt = rtTemp
                requestItemInfo.data = data
                requestItemInfo.end = requestEndTime
            }
        }, { proportion: 0.8 })
    }

    const minRetryIntervalMS = 1000
    const maxRetryIntervalMS = 5000
    const MS = 1000

    const retryUnlimited = makeRetryUnlimited(r,
        () => (minRetryIntervalMS), () => (maxRetryIntervalMS))

    // debugger
    // init data with interval -1
    let time = 0
    retryUnlimited({ interval: -1 }, ([err]) => {
        console.log2('retry', time, 'message:', err)

        const requestItemInfo = requestRTQueue[time]
        time += 1
        // check if code error
        expect(requestItemInfo).not.toBeUndefined()

        if (requestItemInfo.type === RequestErrorType.INIT) {
            requestItemInfo.type = RequestErrorType.DISCARD
            requestItemInfo.discard = new Date().getTime()
        }
    }).then(() => {
        // validate info
        console.log('requestRTQueue', requestRTQueue)

        requestRTQueue.forEach((item, index) => {
            const requestItemInfo = requestRTQueue[index]

            const nextRequestItemInfo = requestRTQueue[index + 1]

            // 请求时间，粗细度
            //
            if (index < (requestRTQueue.length - 1)) {
                // 只能是FAILED 或 SUCCESS
                if (requestItemInfo.type === RequestErrorType.INIT) {
                    // code error
                    expect(true).toBe(false)
                }

                if (requestItemInfo.type === RequestErrorType.DISCARD) {
                    expect(true).toBe(false)
                }
            }

            if (index === (requestRTQueue.length - 1)) {
                expect(requestItemInfo.type).toBe(RequestErrorType.SUCCESS)
            }

            // 相邻两个请求间的请求间隔在范围内
            if (nextRequestItemInfo) {
                expect(nextRequestItemInfo.start - requestItemInfo.start)
                    .toBeLessThanOrEqual(maxRetryIntervalMS)
                expect(nextRequestItemInfo.start - requestItemInfo.start)
                    .toBeGreaterThanOrEqual(minRetryIntervalMS)
            }

            // 相邻两个请求间隔的具体值校验
            if (item.type === RequestErrorType.FAILED || item.type === RequestErrorType.SUCCESS) {
                expect(requestItemInfo.end - requestItemInfo.start)
                    .toBeLessThanOrEqual(maxRetryIntervalMS)

                if (requestItemInfo.end - requestItemInfo.start > minRetryIntervalMS) {
                    if (nextRequestItemInfo) {
                        expect((nextRequestItemInfo.start - requestItemInfo.start) / MS)
                            .toBeCloseTo((requestItemInfo.end - requestItemInfo.start) / MS, 1)
                    }
                }

                if (requestItemInfo.end - requestItemInfo.start < minRetryIntervalMS) {
                    if (nextRequestItemInfo) {
                        expect((nextRequestItemInfo.start - requestItemInfo.start) / MS)
                            .toBeCloseTo(minRetryIntervalMS / MS, 1)
                    }
                }
            }
        })
        done()
    })
}, 40000)
