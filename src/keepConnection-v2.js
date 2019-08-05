// error类型 todo:ts? 需要统一timeoutP定义的error和retry, next函数定义的error
const error = (message = '' ) => ([{ message }, null])
const timeoutP = (timeMS) => (
    new Promise((resolve) => {
        if (timeMS <= 0) {
            // todo:
            resolve(error())
        } else if (timeMS === Infinity) {
            // no resolve
        } else {
            setTimeout(() => { resolve(error()) }, timeMS)
        }
    })
)


const timeRangeMinMax = (makeMinP = () => (0), makeMaxP = () => (Infinity)) => (p) => (
    Promise.race([
        Promise.all([p, timeoutP(makeMinP())]),
        timeoutP(makeMaxP())
    ])
)

export const makeValidRequestWithRetry = (request, timeRange) => {
    return (lastRequestRes) => {
        let stopRetry = () => {}

        const returnP = new Promise((resolve) => {
            let isResolved = false
            resolve = ((oldResolve) => (...args) => {
                isResolved = true
                oldResolve(...args)
            })(resolve)

            stopRetry = () => {
                resolve([{}, null])
            }

            const retry = async () => {
                if (isResolved) return

                const p = request(lastRequestRes)
                    .then(([err, res]) => {
                        if (!err) {
                            resolve([null, res])
                        }
                    })

                await timeRange(p)
                retry()
            }

            retry()
        })

        return [returnP, stopRetry]
    }
}

const defaultMinIntervalTimeMS = 10000

const defaultRetryMinIntervalTimeMS = 10000
const defaultRetryMaxIntervalTimeMS = 30000

const keepConnection = async (request, initRes, exportCall, {
    nextMinIntervalTimeMS = () => (defaultMinIntervalTimeMS),
    retryMinIntervalTimeMS = () => (defaultRetryMinIntervalTimeMS),
    retryMaxIntervalTimeMS = () => (defaultRetryMaxIntervalTimeMS),
}) => {
    const retryTimeRange = timeRangeMinMax(retryMinIntervalTimeMS, retryMaxIntervalTimeMS)

    let stopConnection = false
    let currentStopRetry = () => {}
    const next = async () => {
        const validRequestWithRetry = makeValidRequestWithRetry(request, retryTimeRange)
        const [validRequestWithRetryP, stopRetry] = validRequestWithRetry(initRes)
        currentStopRetry = stopRetry
        // 最小等待时长
        await timeRangeMinMax(nextMinIntervalTimeMS)(validRequestWithRetryP)
        const [error, requestRes] = await validRequestWithRetryP

        if (!error && !stopConnection) {
            exportCall(requestRes)
            next(requestRes)
        }
    }

    return () => {
        // stopRetry()
        currentStopRetry()
        stopConnection = true
    }
}

export default keepConnection
