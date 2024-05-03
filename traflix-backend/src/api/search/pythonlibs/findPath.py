import copy
import datetime
from queue import PriorityQueue
import os
TIMETABLE_FILENAME = "/src/api/search/pythonlibs/timetable_info.txt"
INFO_FILENAME = "/src/api/search/pythonlibs/station.txt"


data = eval(open(os.getcwd() + TIMETABLE_FILENAME).readline())
info = eval(open(os.getcwd() + INFO_FILENAME).readline())


# about INFO


def get_score(station="", type_weight=""):
    if station == "":
        return 0
    if type_weight == "":
        return 0
    if station not in info:
        return 0

    result = 0
    contentTypes = {"weight_type12": "관광지", "weight_type14": "문화시설", "weight_type15": "축제공연행사",
                    "weight_type28": "레포츠", "weight_type32": "숙박", "weight_type38": "쇼핑", "weight_type39": "음식점"}
    for k, name in contentTypes.items():
        value = info[station][k] * type_weight[k]
        result += value

    return result


def get_dist(dept="", dest="", debug=False):
    if dept == "" or dest == "":
        return 0
    if dept not in info or dest not in info:
        return 0

    dept_loc = [info[dept]["station_longitude"],
                info[dept]["station_latitude"]]
    if debug:
        print("dept loc: ", dept_loc)
    dest_loc = [info[dest]["station_longitude"],
                info[dest]["station_latitude"]]
    if debug:
        print("dest loc: ", dest_loc)

    dist = ((dept_loc[0] - dest_loc[0]) ** 2 +
            (dept_loc[1] - dest_loc[1]) ** 2) ** 0.5
    return dist


def to_time(t=""):
    return datetime.time(*map(int, t.split(":")))

# ======================================


def getClosestDistance(visited, next_station):
    minv = 9999.0
    for v in visited:
        minv = min(minv, get_dist(v, next_station))
    return minv


class PriorityEntry(object):
    def __init__(self, priority, data):
        self.data = data
        self.priority = priority

    def __lt__(self, other):
        return self.priority < other.priority


class CustomPriorityQueue(PriorityQueue):
    def _put(self, item):
        if "score" not in item:
            item["score"] = 0
        return super()._put(PriorityEntry(-item["score"], item))

    def _get(self):
        return super()._get().data

# todo: train_type 사용 (현재 미사용)


def pathfind(departure="", destination="", start_time="", minimum_gap="", day_of_the_week="", level_limit=3, dist_threshold=1.0, type_weight="", max_unique_paths=""):
    if departure == "":
        return []
    if destination == "":
        return []
    if start_time == "":
        return []
    if minimum_gap == "":
        return []
    if day_of_the_week == "":
        return []
    if type_weight == "":
        return []
    if max_unique_paths == "":
        return []

    # station code -> station name
    station_code = dict()
    for station in info:
        station_code[info[station]['station_code']] = station

    departure = station_code[departure]
    destination = station_code[destination]

    direct_distance = get_dist(departure, destination)

    if not isinstance(start_time, datetime.time):
        print("start_time isn't proper type, you have to use 'datetime.time'.")
        return []

    if not isinstance(minimum_gap, datetime.timedelta):
        print("minimum_gap isn't proper type, you have to use 'datetime.timedelta'")
        return []

    if day_of_the_week not in ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]:
        print("day_of_the_week only can be MON, TUE, WED, THU, FRI, SAT, SUN.")
        return []

    unique_paths = set()
    result = []
    pq = CustomPriorityQueue()
    pq.put({'score': 0, 'visited': {departure}, 'closest_distance': 9999.0, 'total_distance': 0.0, 'path': [
           {'station': departure, 'train_number': 0, 'train_type': "0", 'depart_time': start_time, 'arrival_time': start_time}]})
    while not pq.empty():
        e = pq.get()
        score, visited, closest_distance, total_distance, path = e['score'], e[
            'visited'], e['closest_distance'], e['total_distance'], e['path']
        departure_station, departure_time = path[len(
            path) - 1]["station"], path[len(path) - 1]["arrival_time"]

        for next_station in data[departure_station]:
            if next_station in visited:
                continue

            next_closest_distance = getClosestDistance(visited, next_station)
            if next_closest_distance <= 0.3:  # 방문한 도시 중에서 현재 가는 곳과 거리가 일정 수치 이하면 포기
                continue

            move_distance = get_dist(departure_station, next_station)
            # if(total_distance + move_distance >= (get_dist(departure, destination) * 2.0)): # 총 이동거리가 매우 긴 거리를 배제하기 위함, 하지만 이유불명 작동하지 않고 있음.
            #   continue

            if get_dist(departure_station, destination) * dist_threshold < get_dist(next_station, destination):
                continue  # dist_threshold, 감소할수록 거리에 대한 제한이 "둔감" 해진다.

            if len(path) + 1 == level_limit:  # 이번에 한 역 더 가면, 끝나는 경우
                if next_station != destination:  # 깊이는 초과 직전인데, 마지막 역이 아닐 경우
                    continue

                # unique path 최대 개수 제한걸기
                route = f"{path[0]['station']}"
                for v in new_path[1:]:
                    route += f"-{v['station']}"
                route += f"-{next_station}"

                if route not in unique_paths:
                    if len(unique_paths) >= max_unique_paths:  # 개수 초과
                        continue
                    unique_paths.add(route)

            # (출발역) -> (다음역) 까지 가는 기차가 여러 개 있을 수 있기 때문에
            for train in data[departure_station][next_station]:
                next_train_number = train['train_number']
                next_train_type = train['train_type']
                next_operating_days = train['operating_days']
                next_depart_time, next_arrival_time = to_time(
                    train['depart_time']), to_time(train['arrival_time'])

                # 요일 체크
                if not next_operating_days[day_of_the_week]:
                    continue

                # 최소 열차 간격시간
                # with_minimum_gap_departure_time = (datetime.datetime.combine(datetime.date.today(), departure_time) + minimum_gap).time()
                # if with_minimum_gap_departure_time > datetime.datetime.combine(datetime.date.today(), next_depart_time).time(): # 갈 수 없는 일정을 제외하기 위한 조건, 만약 다음 날로 넘어가는 경우를 고려하려면 여기를 수정하길 바람. + (2023.10.14 minimum gap 를 고려)
                #   continue

                if departure_station != departure:
                    with_minimum_gap_departure_time = (datetime.datetime.combine(
                        datetime.date.today(), departure_time) + minimum_gap).time()
                else:
                    with_minimum_gap_departure_time = datetime.datetime.combine(
                        datetime.date.today(), departure_time).time()
                # 갈 수 없는 일정을 제외하기 위한 조건, 만약 다음 날로 넘어가는 경우를 고려하려면 여기를 수정하길 바람. + (2023.10.14 minimum gap 를 고려)
                if with_minimum_gap_departure_time > datetime.datetime.combine(datetime.date.today(), next_depart_time).time():
                    continue

                new_score, new_visited, new_path = copy.deepcopy(
                    score), copy.deepcopy(visited), copy.deepcopy(path)

                new_visited.add(next_station)
                new_score = score + get_score(next_station, type_weight)
                new_path.append({'station': next_station, 'train_type': next_train_type, 'train_number': next_train_number,
                                'depart_time': next_depart_time, 'arrival_time': next_arrival_time})

                # print(new_path, pq._qsize(), len(result))
                if next_station == destination:
                    result.append({'score': new_score, 'closest_distance': round(min(
                        closest_distance, next_closest_distance), 2), 'total_distance': round(total_distance + move_distance, 3), 'path': new_path})
                    continue
                pq.put({'score': new_score, 'visited': new_visited, 'closest_distance': min(
                    closest_distance, next_closest_distance), "total_distance": total_distance + move_distance, 'path': new_path})

    return result
