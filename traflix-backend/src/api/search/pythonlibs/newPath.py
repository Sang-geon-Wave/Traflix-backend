# 데이터 불러오기
# 변경하지 않는 것을 매우 추천함.

import os
from queue import PriorityQueue
import datetime
TIMETABLE_FILENAME = "/src/api/search/pythonlibs/timetable_info.txt"
TRAIN_INFO_FILENAME = "/src/api/search/pythonlibs/station.txt"

# 열차 시간표 데이터 로드
train_timetables = eval(open(os.getcwd() + TIMETABLE_FILENAME).readline())
# print(len(train_timetables))
# print("SHDISLDJAK")

# 열차 정보 데이터 로드
#
# 주의! station_longitude 또는 station_latitude 가 NaN 인 경우는 여기에 없습니다. 2023TourAPI_TAGO_preprocessing.ipynb 를 참조해주세요.
#
train_infos = eval(open(os.getcwd() + TRAIN_INFO_FILENAME).readline())
# print(train_infos)
# print(train_infos["서울"])

# (역 코드)와 (역 이름)을 transform할 수 있는 방법
station_codes = dict()
for station_name in train_infos:
    station_codes[train_infos[station_name]['station_code']] = station_name
# print(f"NAT010000의 이름은 {station_codes['NAT010000']}, 부산의 station code는 {train_infos['부산']['station_code']}")

# pathfinding utils


# dp_score: 하나의 역에 대한 점수를 구하는 함수
# 주의! 이 함수의 변경은 결과에 큰 영향을 끼칩니다!
dp_score = dict()  # dp 최적화


def get_score(station="", type_weight=""):
    if station == "":
        return 0
    if type_weight == "":
        return 0
    if station not in train_infos:
        return 0

    key = station + "," + str(type_weight)  # dp key
    if key in dp_score:
        return dp_score[key]  # dp에 key가 존재할 경우 기존에 계산한 결과를 사용

    result = 0
    contentTypes = {"weight_type12": "관광지", "weight_type14": "문화시설", "weight_type15": "축제공연행사",
                    "weight_type28": "레포츠", "weight_type32": "숙박", "weight_type38": "쇼핑", "weight_type39": "음식점"}
    for k, name in contentTypes.items():
        value = train_infos[station][k] * type_weight[k]
        result += value

    dp_score[key] = result
    return result


# dp_dist: 시작역과 도착역에 대한 거리를 구하는 함수 (L2 norm)
# 주의! 이 함수의 변경은 결과에 큰 영향을 끼칩니다!
# 변경하지 않는 것을 매우 추천함.
dp_dist = dict()  # dp 최적화


def get_dist(dept="", dest="", debug=False):
    if dept == "" or dest == "":
        return 0
    if dept not in train_infos or dest not in train_infos:
        return 0

    key = dept + "," + dest  # dp key
    if key in dp_dist:
        return dp_dist[key]  # dp에 key가 존재할 경우 기존에 계산한 결과를 사용

    dept_loc = [train_infos[dept]["station_longitude"],
                train_infos[dept]["station_latitude"]]
    if debug:
        print("dept loc: ", dept_loc)
    dest_loc = [train_infos[dest]["station_longitude"],
                train_infos[dest]["station_latitude"]]
    if debug:
        print("dest loc: ", dest_loc)

    dist = ((dept_loc[0] - dest_loc[0]) ** 2 +
            (dept_loc[1] - dest_loc[1]) ** 2) ** 0.5
    dp_dist[key] = dist
    return dist

# to_time: "HH:MM:SS" 형식의 시간을 datetime.time 타입으로 변환해주는 함수
# 변경하지 않는 것을 매우 추천함.


def to_time(t=""):
    return datetime.time(*map(int, t.split(":")))

# get_closest_distance: 현재까지 방문했던 역(visited)들중에서 next_station 역과 가장 가까운 거리를 구하는 함수
# 변경하지 않는 것을 매우 추천함.


def get_closest_distance(visited, next_station):
    minv = 9999.0
    for v in visited:
        minv = min(minv, get_dist(v, next_station))
    return minv


# pathfinding algorithm v2

# PriorityEntry: PriorityQueue를 커스텀하기 위한 커스텀 원소

class PriorityEntry(object):
    def __init__(self, priority, data):
        self.data = data
        self.priority = priority

    def __lt__(self, other):
        return self.priority < other.priority

# CustomPriorityQueue: Pathfinding할 때 쓰는 우선순위 큐, 무엇을 우선순위로 둘 것인지 정할 수 있음.


class CustomPriorityQueue(PriorityQueue):
    def _put(self, item):
        if "score" not in item:
            item["score"] = 0
        return super()._put(PriorityEntry(-item["score"], item))

    def _get(self):
        return super()._get().data

# todo: train_type 사용 (현재 미사용)
# a_station에서 b_station으로 가기 위한 pathfind 함수, 파라미터를 잘 참고하고 사용하세요.


def pathfind(a_station="", b_station="",  level_limit=3, dist_threshold=1.0, type_weight="", max_unique_paths=""):
    if a_station == "":
        return []
    if b_station == "":
        return []
    if type_weight == "":
        return []
    if max_unique_paths == "":
        return []
    direct_distance = get_dist(a_station, b_station)  # 시작점과 목적지의 거리

    # level_limit가 최소한 2는 되어야 (departure-destination)라는 최소 1개의 경로가 완성됩니다.
    if level_limit < 2:
        print("level_limit must be greater than 2.")
        return []

    # max_unique_paths 매커니즘을 작동시키기 위한 중복 방지 자료구조입니다.
    unique_paths = set()

    result = []
    pq = CustomPriorityQueue()
    pq.put({
        "score": 0,  # 점수
        "visited": {a_station},  # 현재까지 방문한 역들
        "closest_distance": 9999.0,  # 현재까지 방문한 역중 임의의 A, B가 가지는 최소 거리
        "total_distance": 0.0,  # 현재까지 이동한 거리
        "path": [
            {
                "station": a_station,
                # (V2) 미리 열차 번호를 모아놓고, 나중에 처리하는 방식으로 시간복잡도를 분산시킬 수 있습니다.
                "available_trains": [{'train_number': 0, 'train_type': '', 'depart_time': "00:00:00", 'arrival_time': "00:00:00"}]
            }
        ]
    })
    while not pq.empty():  # 우선순위 큐가 비면 탈출합니다.
        e = pq.get()  # 우선순위 큐에서 하나 뽑고 pop이 같이 이뤄집니다.
        score, visited, closest_distance, total_distance, path = e['score'], e[
            'visited'], e['closest_distance'], e['total_distance'], e['path']
        # path의 마지막 역이 출발점이 됩니다.
        departure_station = path[len(path) - 1]["station"]
        available_trains = path[len(path) - 1]["available_trains"]

        for next_station in train_timetables[departure_station]:
            if next_station in visited:
                continue  # 이미 중복된 역이므로 무시합니다.

            # 너무 가까운 역을 재방문하는 경우를 방지하기 위해서 closest_distance가 일정 수치 이하면 건너뜁니다.
            next_closest_distance = get_closest_distance(visited, next_station)
            if next_closest_distance <= 0.3:
                continue

            # 이동한 거리
            move_distance = get_dist(departure_station, next_station)

            # 원래 목적은 목적지와 거리가 멀어질수록 돌아간다고 판단했지만, 어느 정도의 범위내에서는 통과시키기 위해서 dist_threshold를 사용합니다.
            # dist_threshold가 감소할수록 거리에 대한 제한이 "둔감" 해진다.
            if get_dist(departure_station, b_station) * dist_threshold < get_dist(next_station, b_station):
                continue

            # 갱신에 사용할 변수들 미리 정의해놓습니다.
            new_visited, new_path, new_available_trains = set(
                visited), path[:], []

            new_visited.add(next_station)
            new_score = score + get_score(next_station, type_weight)
            for train in train_timetables[departure_station][next_station]:
                train_data = {'train_number': train['train_number'], 'train_type': train['train_type'],
                              'depart_time': train['depart_time'], 'arrival_time': train['arrival_time']}
                new_available_trains.append(train_data)
            new_path.append(
                {'station': next_station, 'available_trains': new_available_trains})

            # 여기서 한번 더 역을 이동하고 끝나는 경우
            if len(path) + 1 == level_limit:
                if next_station != b_station:
                    continue  # 목적지가 아닌 경우, 정답이 될 수 없음.

                # unique path는 역들의 유일한 집합을 의미합니다.
                # 그리고, 최대 개수를 제한 걸어서 과부하되는 것을 방지합니다.
                route = f"{path[0]['station']}"
                for v in path[1:]:
                    route += f"-{v['station']}"
                route += f"-{next_station}"

                if route not in unique_paths:  # 새로운 unique path 추가
                    if len(unique_paths) >= max_unique_paths:
                        continue  # 개수 초과
                    unique_paths.add(route)
                    result.append({"score": new_score, 'closest_distance': round(min(
                        closest_distance, next_closest_distance), 2), 'total_distance': round(total_distance + move_distance, 3), "path": new_path})
                    continue
            pq.put({"score": new_score, "visited": new_visited, 'closest_distance': min(
                closest_distance, next_closest_distance), 'total_distance': total_distance + move_distance, "path": new_path})
    return result

# 실제 available_train_numbers를 적용한 최적화된 시간대를 뽑아내야함.

# 가능한 최적화된 하나의 경로만을 뽑아냄.
# 중요! pathfind 함수는 unique path들의 리스트들을 되돌려주고, 이 get_optimized_one_route의 파라미터에는 하나의 unique path에만 넣어야 합니다.


def get_optimized_one_route(unique_path="", start_time="", minimum_gap="", day_of_the_week=""):
    if unique_path == "":
        return []
    if start_time == "":
        return []
    if minimum_gap == "":
        return []
    if day_of_the_week == "":
        return []

    paths = unique_path['path']
    if len(paths) < 2:  # 아예 성립하지 않는 경우
        return []

    a_station = paths[0]['station']
    # start_time은 시작 시간이므로 datetime.time와 일치해야 한다.
    # 만약에 문자열 "HH:MM:SS" 형태라면, to_time() 함수를 사용해서 변환 후 사용할 수 있다.
    if not isinstance(start_time, datetime.time):
        print("start_time isn't proper type, you have to use 'datetime.time'.")
        return []

    # minimum_gap은 열차 간격 시간으로 datetime.timedelta와 일치해야 한다.
    if not isinstance(minimum_gap, datetime.timedelta):
        print("minimum_gap isn't proper type, you have to use 'datetime.timedelta'")
        return []

    # 탑승하는 요일을 여쭤보는 day_of_the_week입니다.
    if day_of_the_week not in ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]:
        print("day_of_the_week only can be MON, TUE, WED, THU, FRI, SAT, SUN.")
        return []

    # 반복을 시작할 index와 끝나는 index (하지만, index가 얌전하게 증가만 하지 않는다는 것을 참고하자.)
    idx, n = 1, len(paths) - 1

    result = [{} for _ in range(0, n + 1)]
    result[0] = {'station': a_station, 'train_number': 0, 'train_type': '',
                 # 출발역에 대한 덤프값
                 'depart_time': str(start_time), 'arrival_time': str(start_time)}
    train_idx = [-1 for _ in range(0, n + 1)]  # 각 역마다 기차를 배정하기 위한 index

    for i in range(1, n + 1):  # 각 역에서 탈 수 있는 열차번호들을 특정 조건을 만족하는 순서대로 정렬합니다.
        paths[i]["available_trains"].sort(key=lambda x: (
            to_time(x["depart_time"]), to_time(x["arrival_time"])))
    while idx <= n:
        if idx == 0:
            return []  # 이 경우는 아예 완성이 안되는 경우일 때이다.

        # idx번째의 여정의 기차의 번호를 한 칸 앞으로 이동해줍니다.
        train_idx[idx] = train_idx[idx] + 1
        if train_idx[idx] >= len(paths[idx]['available_trains']):  # 배치할 수 없는 경우
            # 다음을 위해 현재 기차를 배정하기 위한 index를 초기화하고, 이전 단계로 넘어가서 재확인한다.
            train_idx[idx], idx = 0, idx - 1
            continue

        schedules = paths[idx]  # 일부러 반복을 안 쓰고, 안으로 넣어둠.
        departure_time = result[idx - 1]['arrival_time']  # 이전에 도착한 시간
        # 현재 출발하려고 하는 기차에 대한 가야하는 도착 역과 정보
        now_station, now_train_info = schedules['station'], schedules['available_trains'][train_idx[idx]]
        # 현재 출발하려고 하는 기차에 대한 출발 시간과 도착 시간
        now_depart_time, now_arrival_time = now_train_info[
            'depart_time'], now_train_info['arrival_time']

        # 최소 열차 간격시간
        if idx != 1:
            with_minimum_gap_departure_time = (datetime.datetime.combine(
                datetime.date.today(), to_time(departure_time)) + minimum_gap).time()
        else:
            with_minimum_gap_departure_time = datetime.datetime.combine(
                datetime.date.today(), to_time(departure_time)).time()
        # 갈 수 없는 일정을 제외하기 위한 조건, 만약 다음 날로 넘어가는 경우를 고려하려면 여기를 수정하길 바람.
        if with_minimum_gap_departure_time > datetime.datetime.combine(datetime.date.today(), to_time(now_depart_time)).time():
            continue

        # 성공적으로 기차를 배정했을 경우 (하지만, 뒤에서 불가능해서 다시 증가할 수 있다.)
        result[idx] = {'station': now_station, 'train_number': now_train_info['train_number'],
                       'train_type': now_train_info['train_type'], 'depart_time': now_depart_time, 'arrival_time': now_arrival_time}
        idx = idx + 1
    return result


def pathfind_with_time(departure="", destination="", start_time="", minimum_gap="", day_of_the_week="", level_limit=3, dist_threshold=1.0, type_weight="", max_unique_paths="", result_size=0):
    paths = pathfind(a_station=station_codes[departure], b_station=station_codes[destination], level_limit=level_limit,
                     dist_threshold=dist_threshold, type_weight=type_weight, max_unique_paths=max_unique_paths)
    result = []
    for path in paths:
        path_with_time = get_optimized_one_route(
            unique_path=path, start_time=start_time, minimum_gap=minimum_gap, day_of_the_week=day_of_the_week)
        if len(path_with_time) != 0:
            result.append({'score': path['score'], 'path': path_with_time})
    return result[:result_size]
