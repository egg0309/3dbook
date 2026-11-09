PY ?= python

L1_DIR := 01_机器执行/01_L1_契约测试
L2_DIR := 01_机器执行/02_L2_生成采样
L3_DIR := 01_机器执行/03_L3_红队扫描
L4_DIR := 01_机器执行/04_L4_数据分析

.PHONY: l1 l2 l3 check analyze

l1:
	$(PY) -m pytest $(L1_DIR)

l2:
	$(PY) $(L2_DIR)/run_sampling.py

l3:
	$(PY) $(L3_DIR)/run_redteam.py

check:
	$(PY) $(L2_DIR)/run_sampling.py --dry-run
	$(PY) $(L3_DIR)/run_redteam.py --dry-run

analyze:
	$(PY) $(L4_DIR)/aggregate_scores.py
	$(PY) $(L4_DIR)/aggregate_review.py
