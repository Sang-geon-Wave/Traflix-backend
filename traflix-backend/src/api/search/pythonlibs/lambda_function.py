import json
import sys
import findPath
import datetime
import newPath


def postProcess(result):
    ret = []
    check = set()
    for i in result:
        if len(i["path"]) == 2:
            continue

        score = i["score"]
        paths = i["path"]
        TourStation = paths[1]["station"]
        if TourStation in check:
            continue
        check.add(TourStation)

        newpath = []
        for j in range(0, len(paths)-1):
            dept_station = paths[j]["station"]
            traintype = paths[j+1]["train_type"]
            trainnum = paths[j+1]["train_number"]
            # depart_time=paths[j+1]["depart_time"].strftime("%H:%M:%S")
            depart_time = paths[j+1]["depart_time"]
            arrstation = paths[j+1]["station"]
            arrtime = paths[j+1]["arrival_time"]
            # arrtime=paths[j+1]["arrival_time"].strftime("%H:%M:%S")

            newpath.append({"DeptStation": dept_station,
                            "TrainType": traintype,
                            "TrainNumber": trainnum,
                            "DeptTime": depart_time,
                            "ArrStation": arrstation,
                            "ArrTime": arrtime,
                            })

        ret.append(
            {"Score": score, "TourStation": TourStation, "Path": newpath})

    return ret


def lambda_handler(event):
    departure = event["Dep"]
    destination = event["Arr"]
    start_time = event["Time"]
    minimum_gap = 4
    day_of_the_week = event["Day"]

    level_limit = 3
    dist_threshold = 1.3

    type_weight = event["Weight"]
    max_unique_paths = 100

    result_size = 10

    res = newPath.pathfind_with_time(departure,
                                     destination,
                                     findPath.to_time(start_time),
                                     datetime.timedelta(hours=minimum_gap),
                                     day_of_the_week,
                                     level_limit,
                                     dist_threshold,
                                     type_weight,
                                     max_unique_paths,
                                     result_size
                                     )

    # old but works well
    # res = findPath.pathfind(departure,
    #                         destination,
    #                         findPath.to_time(start_time),
    #                         datetime.timedelta(hours = minimum_gap),
    #                         day_of_the_week,
    #                         level_limit,
    #                         dist_threshold,
    #                         type_weight,
    #                         max_unique_paths
    #                         )

    return {
        'statusCode': 200,
        'body': postProcess(res)
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(1)
    event = {}
    event["Dep"] = sys.argv[1]
    event["Arr"] = sys.argv[2]
    event["Time"] = sys.argv[3]
    event["Day"] = sys.argv[4]
    event["Weight"] = {
        "weight_type12": int(sys.argv[5]),
        "weight_type14": int(sys.argv[6]),
        "weight_type15": int(sys.argv[7]),
        "weight_type28": int(sys.argv[8]),
        "weight_type32": int(sys.argv[9]),
        "weight_type38": int(sys.argv[10]),
        "weight_type39": int(sys.argv[11]),
    }
    print(json.dumps(lambda_handler(event)))
